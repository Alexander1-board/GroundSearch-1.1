import {
  GoogleGenerativeAI,
  GenerateContentResponse,
  Type,
  Content,
  Part,
  Tool,
} from '@google/genai';
import { TIMEOUTS } from '../constants';
import {
  ResearchBrief,
  ExecutionPlan,
  RecordLite,
  ResearchJob,
  Evidence,
  InsightPackResult,
  FinalAnswererResult,
  ChatMessage,
  DeepResearchResult,
  FacetResult,
} from '../types';
import { SYSTEM_GUARDRAILS } from '../prompts/system';
import * as AgentPrompts from '../prompts/agents';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error('VITE_GEMINI_API_KEY is not set. Add it to .env.local');
}

export const ai = new GoogleGenerativeAI({ apiKey: API_KEY });

// --- Core API Helpers ---

async function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('ETIMEDOUT')), ms),
  );
  return Promise.race([fn(), timeoutPromise]);
}

async function retry<T>(op: () => Promise<T>, tries: number = 6): Promise<T> {
  let lastErr: Error | undefined;
  for (let i = 0; i < tries; i++) {
    try {
      return await op();
    } catch (e: any) {
      lastErr = e;
      if (i < tries - 1) {
        const isRateLimitError =
          e.message && (e.message.includes('429') || e.message.includes('RESOURCE_EXHAUSTED'));
        if (isRateLimitError) {
          // Much more aggressive backoff. i=0->5s, i=1->10s, i=2->20s, i=3->40s, i=4->80s
          const backoffTime = 5000 * Math.pow(2, i) + Math.random() * 1000;
          console.warn(
            `Attempt ${i + 1}/${tries - 1} failed due to rate limit. Retrying in ${backoffTime.toFixed(0)}ms...`,
            e.message,
          );
          await new Promise((r) => setTimeout(r, backoffTime));
        } else {
          console.warn(`Attempt ${i + 1}/${tries - 1} failed. Retrying...`, e.message);
          await new Promise((r) => setTimeout(r, 3000 + Math.random() * 1000));
        }
      }
    }
  }
  throw lastErr!;
}

export const logAPICall = (model: string, start_ts: number) => {
  const end_ts = Date.now();
  console.log({
    event: 'gemini_call_completed',
    model,
    start_ts,
    end_ts,
    duration_ms: end_ts - start_ts,
  });
};

export async function callModelAPI<T>(
  modelName: string,
  contents: Content[],
  isJson: boolean,
  schema?: any,
  tools?: Tool[],
  maxOutputTokens?: number,
): Promise<T> {
  if (!API_KEY) throw new Error('API Key is not configured.');

  const config: any = {
    systemInstruction: SYSTEM_GUARDRAILS,
  };

  // Per Gemini docs, responseMimeType/responseSchema cannot be used with tools.
  if (tools) {
    config.tools = tools;
  } else if (isJson) {
    config.responseMimeType = 'application/json';
    if (schema) config.responseSchema = schema;
  }

  if (maxOutputTokens) {
    config.maxOutputTokens = maxOutputTokens;
    if (modelName.includes('flash')) {
      config.thinkingConfig = { thinkingBudget: Math.floor(maxOutputTokens / 2) };
    }
  }

  const start_ts = Date.now();
  try {
    const result = await ai.getGenerativeModel({ model: model }).generateContent({
      model: modelName,
      contents,
      config,
    });
    logAPICall(modelName, start_ts);

    const text = result.text.trim();
    if (isJson) {
      let jsonStr = text;
      const markerMatch = text.match(/<<<JSON_START>>>(.*?)<<<JSON_END>>>/s);

      if (markerMatch && markerMatch[1]) {
        jsonStr = markerMatch[1].trim();
      } else if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/```json\n|```/g, '').trim();
      }

      // Repair common JSON issues like trailing commas
      const repairedJsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');

      try {
        return JSON.parse(repairedJsonStr) as T;
      } catch (parseError) {
        console.error('Failed to parse JSON response:', repairedJsonStr.substring(0, 500));
        throw new Error(
          `Malformed JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        );
      }
    }
    return text as T;
  } catch (error) {
    logAPICall(modelName, start_ts);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage === 'ETIMEDOUT') throw new Error('Model call timed out.');
    throw new Error(`Gemini API call failed: ${errorMessage}`);
  }
}

// --- Schemas for Reasoning Agents ---

const researchBriefSchema = {
  type: Type.OBJECT,
  properties: {
    objective: { type: Type.STRING },
    key_questions: { type: Type.ARRAY, items: { type: Type.STRING } },
    scope: {
      type: Type.OBJECT,
      properties: {
        timeframe: {
          type: Type.OBJECT,
          properties: {
            from: { type: Type.INTEGER },
            to: { type: Type.INTEGER },
          },
          required: ['from', 'to'],
        },
        domains: { type: Type.ARRAY, items: { type: Type.STRING } },
        comparators: { type: Type.ARRAY, items: { type: Type.STRING } },
        geography: { type: Type.STRING },
      },
      required: ['timeframe', 'domains', 'comparators'],
    },
    deliverable: { type: Type.STRING },
    success_criteria: { type: Type.ARRAY, items: { type: Type.STRING } },
    assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
    inferred_fields: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['objective', 'key_questions', 'scope', 'deliverable', 'success_criteria'],
};

const executionStepSchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    agent: { type: Type.STRING },
    action: {
      type: Type.STRING,
      enum: [
        'SEARCH',
        'SCREEN',
        'COMPARE',
        'ANSWER',
        'INGEST',
        'RESEARCH_FACET',
        'SYNTHESIZE_RESEARCH',
      ],
    },
    params: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'The search query for a SEARCH action.' },
        url: { type: Type.STRING, description: 'The URL to ingest for an INGEST action.' },
        facet_name: { type: Type.STRING, description: 'The name of the facet to research.' },
      },
      // This allows the model to return an empty object for steps that do not require parameters,
      // satisfying the API's validation requirement that an object schema must define its properties.
      additionalProperties: true,
    },
    expects: {
      type: Type.STRING,
      enum: [
        'RecordLite[]',
        'Evidence[]',
        'Report',
        'FinalAnswer',
        'FacetResult',
        'DeepResearchResult',
      ],
    },
    specialist_instructions: { type: Type.STRING },
    status: { type: Type.STRING, enum: ['Pending'] },
  },
  required: ['id', 'agent', 'action', 'params', 'expects', 'status'],
};

const executionPlanSchema = {
  type: Type.OBJECT,
  properties: {
    plan_id: { type: Type.STRING },
    rationale_summary: { type: Type.STRING },
    source_selection: { type: Type.ARRAY, items: { type: Type.STRING } },
    steps: {
      type: Type.ARRAY,
      items: executionStepSchema,
    },
    evaluation: {
      type: Type.OBJECT,
      properties: {
        success_criteria: { type: Type.ARRAY, items: { type: Type.STRING } },
        risks: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['success_criteria', 'risks'],
    },
  },
  required: ['plan_id', 'rationale_summary', 'source_selection', 'steps', 'evaluation'],
};

const evidenceSchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    title: { type: Type.STRING },
    url: { type: Type.STRING },
    year: { type: Type.INTEGER },
    key_outcome: { type: Type.STRING },
    source_id: { type: Type.STRING },
    snippet: { type: Type.STRING },
    quant_score: { type: Type.NUMBER, description: 'Quantitative score from 0-100.' },
    matches_questions: { type: Type.BOOLEAN },
    within_timeframe: { type: Type.BOOLEAN },
    has_comparators: { type: Type.BOOLEAN },
    has_quant_outcomes: { type: Type.BOOLEAN },
  },
  required: [
    'id',
    'title',
    'url',
    'source_id',
    'matches_questions',
    'within_timeframe',
    'has_comparators',
    'has_quant_outcomes',
  ],
};

const screeningResultSchema = {
  type: Type.OBJECT,
  properties: {
    kept: {
      type: Type.ARRAY,
      items: evidenceSchema,
    },
    dropped_count: { type: Type.NUMBER },
  },
  required: ['kept', 'dropped_count'],
};

// --- Insight Pack Schema (Corrected) ---

const themeRelationDetailsSchema = {
  type: Type.OBJECT,
  properties: {
    relation: { type: Type.STRING, enum: ['supports', 'contradicts', 'neutral'] },
    note: { type: Type.STRING },
    evidence_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['relation', 'note', 'evidence_ids'],
  additionalProperties: true,
};

const themeSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    conflict_score: { type: Type.NUMBER },
    corroboration_count: { type: Type.NUMBER },
    contradiction_count: { type: Type.NUMBER },
    relations: {
      type: Type.ARRAY,
      description: 'An array of objects detailing platform relations to the theme.',
      items: {
        type: Type.OBJECT,
        properties: {
          platform: { type: Type.STRING },
          details: themeRelationDetailsSchema,
        },
        required: ['platform', 'details'],
        additionalProperties: true,
      },
    },
  },
  required: ['name', 'conflict_score', 'relations'],
};

const insightPackComparisonResultSchema = {
  type: Type.OBJECT,
  properties: {
    themes: {
      type: Type.ARRAY,
      items: themeSchema,
    },
  },
  required: ['themes'],
};

const insightPackSynthesisReportSchema = {
  type: Type.OBJECT,
  properties: {
    markdown: { type: Type.STRING },
    rationale_summary: { type: Type.STRING },
    uncertainties: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['markdown', 'rationale_summary'],
};

const nextStepSchema = {
  type: Type.OBJECT,
  properties: {
    description: { type: Type.STRING },
    search_query: { type: Type.STRING },
    reason: { type: Type.STRING },
    priority: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
  },
  required: ['description', 'search_query', 'reason', 'priority'],
};

const sourceAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    source_id: { type: Type.STRING },
    role: {
      type: Type.STRING,
      enum: ['primary', 'official', 'peer_reviewed', 'reputable_media', 'blog', 'forum'],
    },
    provenance_hints: { type: Type.STRING },
  },
  required: ['source_id', 'role', 'provenance_hints'],
  additionalProperties: true,
};

const metaTraceSchema = {
  type: Type.OBJECT,
  properties: {
    high_conflict_themes: { type: Type.ARRAY, items: { type: Type.STRING } },
    sparse_evidence_themes: { type: Type.ARRAY, items: { type: Type.STRING } },
    platform_source_counts: {
      type: Type.ARRAY,
      description: 'An array of objects mapping platform names to their source counts.',
      items: {
        type: Type.OBJECT,
        properties: {
          platform: { type: Type.STRING },
          count: { type: Type.INTEGER },
        },
        required: ['platform', 'count'],
        additionalProperties: true,
      },
    },
    source_analysis: {
      type: Type.ARRAY,
      items: sourceAnalysisSchema,
    },
  },
  required: ['high_conflict_themes', 'sparse_evidence_themes', 'platform_source_counts'],
};

const insightPackSchema = {
  type: Type.OBJECT,
  properties: {
    comparisonResult: insightPackComparisonResultSchema,
    synthesisReport: insightPackSynthesisReportSchema,
    nextSteps: { type: Type.ARRAY, items: nextStepSchema },
    brief_refinements: { type: Type.ARRAY, items: { type: Type.STRING } },
    meta_trace: metaTraceSchema,
  },
  required: ['comparisonResult', 'synthesisReport', 'nextSteps', 'brief_refinements', 'meta_trace'],
};

// --- Final Answerer Schema ---
const themeConfidenceSchema = {
  type: Type.OBJECT,
  properties: {
    theme: { type: Type.STRING },
    confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
    reason: { type: Type.STRING },
    sources: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['theme', 'confidence', 'reason', 'sources'],
};

const highValueSourceReasonSchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    why: { type: Type.STRING },
  },
  required: ['id', 'why'],
};

const finalAnswererResultSchema = {
  type: Type.OBJECT,
  properties: {
    answer: { type: Type.STRING },
    markdown_body: { type: Type.STRING },
    theme_confidences: { type: Type.ARRAY, items: themeConfidenceSchema },
    next_steps: { type: Type.ARRAY, items: { type: Type.STRING } },
    high_value_sources: { type: Type.ARRAY, items: highValueSourceReasonSchema },
    uncertainties: { type: Type.ARRAY, items: { type: Type.STRING } },
    rationale_summary: { type: Type.STRING },
  },
  required: [
    'answer',
    'markdown_body',
    'theme_confidences',
    'next_steps',
    'high_value_sources',
    'uncertainties',
    'rationale_summary',
  ],
};

// --- Deep Research Schema ---
const facetClaimSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    source_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
    confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
    why_high_value: { type: Type.STRING },
  },
  required: ['summary', 'source_ids', 'confidence', 'why_high_value'],
};

const facetResultSchema = {
  type: Type.OBJECT,
  properties: {
    claims: { type: Type.ARRAY, items: facetClaimSchema },
    coverage: { type: Type.STRING, enum: ['direct', 'indirect', 'none'] },
    tried: {
      type: Type.OBJECT,
      properties: {
        queries: { type: Type.ARRAY, items: { type: Type.STRING } },
        auxiliary: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['queries', 'auxiliary'],
      additionalProperties: true,
    },
    note_if_missing: { type: Type.STRING },
  },
  required: ['claims', 'coverage', 'tried'],
};

const recordLiteSchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    title: { type: Type.STRING },
    url: { type: Type.STRING },
    snippet: { type: Type.STRING },
    published: { type: Type.INTEGER },
    source_id: { type: Type.STRING },
  },
  required: ['id', 'title', 'url', 'source_id'],
};

const deepResearchResultSchema = {
  type: Type.OBJECT,
  properties: {
    facet_results: {
      type: Type.OBJECT,
      properties: {
        governance: facetResultSchema,
        ownership: facetResultSchema,
        control: facetResultSchema,
        decentralization_claims: facetResultSchema,
        technical_architecture: facetResultSchema,
      },
      required: [
        'governance',
        'ownership',
        'control',
        'decentralization_claims',
        'technical_architecture',
      ],
      additionalProperties: true,
    },
    overall_assessment: { type: Type.STRING },
    sources: { type: Type.ARRAY, items: recordLiteSchema },
  },
  required: ['facet_results', 'overall_assessment', 'sources'],
};

// --- Agent Implementations ---

export const runConversationAgent = (
  model: string,
  history: ResearchJob['chatHistory'],
  currentBrief: ResearchBrief,
) => {
  const newPromptText = AgentPrompts.getConversationAgentPrompt(currentBrief);

  const prompt: Content[] = [
    ...history,
    {
      role: 'user',
      parts: [
        {
          text: newPromptText,
        },
      ],
    },
  ];
  const schema = {
    type: Type.OBJECT,
    properties: {
      reply: { type: Type.STRING },
      outline: researchBriefSchema,
    },
    required: ['reply', 'outline'],
  };
  return retry(() =>
    withTimeout(
      () => callModelAPI<{ reply: string; outline: ResearchBrief }>(model, prompt, true, schema),
      TIMEOUTS.conversation,
    ),
  );
};

export const runOrchestrationAgent = (model: string, brief: ResearchBrief) => {
  const prompt: Content[] = [
    {
      role: 'user',
      parts: [{ text: AgentPrompts.getOrchestrationAgentPrompt(brief) }],
    },
  ];

  return retry(() =>
    withTimeout(
      () => callModelAPI<ExecutionPlan>(model, prompt, true, executionPlanSchema),
      TIMEOUTS.plan,
    ),
  );
};

export const runFacetResearchAgent = async (
  model: string,
  facetName: string,
  brief: ResearchBrief,
): Promise<{ resultText: string; sources: RecordLite[] }> => {
  const promptText = AgentPrompts.getFacetResearchAgentPrompt(facetName, brief);
  const prompt: Content[] = [{ role: 'user', parts: [{ text: promptText }] }];

  const op = async () => {
    const start_ts = Date.now();
    try {
      const result = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_GUARDRAILS,
          tools: [{ googleSearch: {} }],
        },
      });
      logAPICall(model, start_ts);

      const resultText = result.text.trim();

      const groundingChunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = groundingChunks.map((chunk: any, index: number) => ({
        id: `web-${facetName}-${Date.now()}-${index}`,
        title: chunk.web?.title || 'Untitled Search Result',
        url: chunk.web?.uri || '',
        snippet: chunk.web?.snippet || 'No snippet available.',
        source_id: 'web',
      }));

      return { resultText, sources };
    } catch (error) {
      logAPICall(model, start_ts);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Gemini Facet Research call failed for '${facetName}': ${errorMessage}`);
    }
  };

  return retry(() => withTimeout(op, TIMEOUTS.toolSearch));
};

export const runResearchSynthesisAgent = (
  model: string,
  facetSummaries: string,
  sources: RecordLite[],
) => {
  const promptText = AgentPrompts.getResearchSynthesisAgentPrompt(facetSummaries, sources);
  const prompt: Content[] = [{ role: 'user', parts: [{ text: promptText }] }];

  return retry(() =>
    withTimeout(
      () =>
        callModelAPI<DeepResearchResult>(
          model,
          prompt,
          true,
          deepResearchResultSchema,
          undefined,
          16384,
        ),
      TIMEOUTS.insightPack,
    ),
  );
};

export const runScreeningAgent = (model: string, records: RecordLite[], brief: ResearchBrief) => {
  const promptText = AgentPrompts.getScreeningAgentPrompt(records, brief);
  const prompt: Content[] = [
    {
      role: 'user',
      parts: [{ text: promptText }],
    },
  ];

  return retry(() =>
    withTimeout(
      () =>
        callModelAPI<{ kept: Evidence[]; dropped_count: number }>(
          model,
          prompt,
          true,
          screeningResultSchema,
          undefined,
          8192,
        ),
      TIMEOUTS.extract,
    ),
  );
};

export const runInsightPackAgent = (
  model: string,
  job: ResearchJob,
): Promise<InsightPackResult> => {
  const promptText = AgentPrompts.getInsightPackAgentPrompt(job);

  const prompt: Content[] = [
    {
      role: 'user',
      parts: [{ text: promptText }],
    },
  ];

  return retry(() =>
    withTimeout(
      () =>
        callModelAPI<InsightPackResult>(model, prompt, true, insightPackSchema, undefined, 16384),
      TIMEOUTS.insightPack,
    ),
  );
};

export const runAnswererAgent = (model: string, job: ResearchJob): Promise<FinalAnswererResult> => {
  const promptText = AgentPrompts.getAnswererAgentPrompt(job);

  const prompt: Content[] = [
    {
      role: 'user',
      parts: [{ text: promptText }],
    },
  ];

  return retry(() =>
    withTimeout(
      () =>
        callModelAPI<FinalAnswererResult>(
          model,
          prompt,
          true,
          finalAnswererResultSchema,
          undefined,
          16384,
        ),
      TIMEOUTS.synthesis,
    ),
  );
};

export const runFollowUpChat = (
  model: string,
  job: ResearchJob,
  history: ChatMessage[],
  newQuestion: string,
): Promise<string> => {
  const promptText = AgentPrompts.getFollowUpChatPrompt(job, history, newQuestion);

  const prompt: Content[] = [
    {
      role: 'user',
      parts: [{ text: promptText }],
    },
  ];

  // This is a conversational text response, not JSON.
  return retry(() =>
    withTimeout(
      () =>
        callModelAPI<string>(
          model,
          prompt,
          false, // isJson = false
          undefined,
          undefined,
          4096, // Max output tokens for a chat response
        ),
      TIMEOUTS.conversation,
    ),
  );
};
