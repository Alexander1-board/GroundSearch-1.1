// services/tools.ts
import { Type, Content } from '@google/genai';
import type {
  RecordLite,
  Evidence,
  HighValueSource,
  InsightPackResult,
  FinalAnswererResult,
} from '../types';
import { ai, logAPICall, callModelAPI } from './geminiService';

/* ------------------------------------------------------------------ */
/* 1. Gemini web-search helper                                        */
/* ------------------------------------------------------------------ */

export async function search_web(model: string, query: string, k = 10): Promise<RecordLite[]> {
  if (!import.meta.env.VITE_GEMINI_API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY is not set');
  }

  const t0 = Date.now();

  const result = await (ai as any).models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [{ text: `Find up-to-date sources for: ${query}` }],
      },
    ],
    tools: [{ googleSearch: {} }],
  } as any);

  logAPICall(model, t0);

  const chunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  if (!Array.isArray(chunks) || chunks.length === 0) return [];

  return chunks.slice(0, Math.max(0, k)).map((chunk, idx) => {
    const web: any = (chunk as any).web ?? {};
    return {
      id: `web-${Date.now()}-${idx}`,
      title: typeof web.title === 'string' ? web.title : 'Untitled search result',
      url: typeof web.uri === 'string' ? web.uri : '',
      snippet: typeof web.snippet === 'string' ? web.snippet : 'No snippet.',
      source_id: 'web',
    } as RecordLite;
  });
}

/* ------------------------------------------------------------------ */
/* 2. Wolfram|Alpha simple-result helper                               */
/* ------------------------------------------------------------------ */

export async function wolfram_query(
  query: string,
  appId = import.meta.env.VITE_WOLFRAM_ALPHA_APPID ?? '',
): Promise<RecordLite[]> {
  if (!appId) return []; // soft-fail

  const url = `https://api.wolframalpha.com/v1/result?appid=${encodeURIComponent(
    appId,
  )}&i=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 501) return []; // “didn’t understand input”
      throw new Error(`Wolfram error ${res.status}`);
    }
    const text = await res.text();
    return [
      {
        id: `wolfram-${Date.now()}`,
        title: `W|A result for “${query}”`,
        url,
        snippet: text,
        source_id: 'wolfram',
      },
    ];
  } catch {
    return []; // pipeline-safe
  }
}

/* ------------------------------------------------------------------ */
/* 3. Generic URL ingestion helper                                     */
/* ------------------------------------------------------------------ */

export async function ingest_url(url: string): Promise<{ title: string; cleanedText: string }> {
  const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);

  const html = await res.text();
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? 'Untitled';

  const cleanedText = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/\s\s+/g, ' ')
    .trim();

  return { title, cleanedText };
}

/* ------------------------------------------------------------------ */
/* 4. Claim extractor (LLM JSON-tool)                                  */
/* ------------------------------------------------------------------ */

export async function extract_claims(
  model: string,
  text: string,
  sourceUrl: string,
): Promise<Evidence[]> {
  const prompt: Content[] = [
    {
      role: 'user',
      parts: [
        {
          text: `Source URL: ${sourceUrl}
Text (trimmed to 30 kB):
---
${text.slice(0, 30000)}
---
TASK: Extract testable claims. Return ONLY a JSON array of objects with
"id", "title", "url", "snippet" and "source_id".`,
        },
      ],
    },
  ];

  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        title: { type: Type.STRING },
        url: { type: Type.STRING },
        snippet: { type: Type.STRING },
        source_id: { type: Type.STRING },
      },
      required: ['id', 'title', 'url', 'snippet', 'source_id'],
    },
  };

  return callModelAPI<Evidence[]>(
    model,
    prompt,
    /* stream  */ true,
    schema,
    /* temp    */ undefined,
    /* maxTok  */ 8192,
  );
}

/* ------------------------------------------------------------------ */
/* 5. Credibility + high-value scoring utilities (unchanged)           */
/* ------------------------------------------------------------------ */
export function deduplicateRecords(records: RecordLite[]): RecordLite[] {
  const seen = new Set<string>();
  const out: RecordLite[] = [];
  for (const r of records) {
    if (!seen.has(r.url)) {
      seen.add(r.url);
      out.push(r);
    }
  }
  return out;
}

export function score_credibility(record: RecordLite): { score: number } {
  return { score: record.published ? 1 : 0 };
}

export function calculateHighValueScore(evidence: Evidence[]): HighValueSource[] {
  return evidence.map((e, idx) => ({
    sTag: `S${idx + 1}`,
    title: e.title,
    score: e.quant_score ?? 0,
    reasons: [],
  }));
}

export function enforceCitationsAndUncertainties<T>(data: T): T {
  return data;
}

export function postProcessFinalAnswer<T>(answer: T): T {
  return answer;
}
