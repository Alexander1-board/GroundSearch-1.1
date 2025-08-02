// services/tools.ts
import { Type, Content } from "@google/genai";
import { RecordLite, Evidence, InsightPackResult, HighValueSource, FinalAnswererResult } from '../types';
import { ai, logAPICall, callModelAPI } from './geminiService';

export async function search_web(model: string, query: string, k: number = 10): Promise<RecordLite[]> {
    console.log(`Executing direct search with query: "${query}"`);
    if (!process.env.API_KEY) throw new Error("API Key is not configured.");
    
    const start_ts = Date.now();
    try {
        const result = await ai.models.generateContent({
            model: model, 
            contents: [{ role: 'user', parts: [{ text: `Find up-to-date sources for: ${query}` }] }],
            config: { tools: [{ googleSearch: {} }] }
        });
        logAPICall(model, start_ts);

        const groundingChunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        
        if (!groundingChunks || groundingChunks.length === 0) {
            console.log("Google Search tool returned no results.");
            return [];
        }

        return groundingChunks.map((chunk: any, index: number) => ({
            id: `web-${Date.now()}-${index}`,
            title: chunk.web?.title || 'Untitled Search Result',
            url: chunk.web?.uri || '',
            snippet: chunk.web?.snippet || 'No snippet available.',
            source_id: 'web',
        })).slice(0, k);

    } catch (error) {
        logAPICall(model, start_ts);
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage === 'ETIMEDOUT') throw new Error('Model call timed out during search.');
        throw new Error(`Gemini Search Tool call failed: ${errorMessage}`);
    }
}

export async function wolfram_query(query: string, appId: string): Promise<RecordLite[]> {
    console.log(`Querying Wolfram|Alpha: "${query}"`);
    if (!appId) {
        console.warn("Wolfram|Alpha App ID is missing.");
        return [];
    }

    const queryUrl = `https://api.wolframalpha.com/v1/result?appid=${appId}&i=${encodeURIComponent(query)}`;
    
    try {
        const response = await fetch(queryUrl);
        if (!response.ok) {
            if (response.status === 501) { // Not implemented / doesn't understand query
                console.log(`Wolfram|Alpha could not answer the query: ${query}`);
                return [];
            }
            throw new Error(`Wolfram|Alpha API error: ${response.status} ${response.statusText}`);
        }

        const resultText = await response.text();
        return [{
            id: `wolfram-${Date.now()}`,
            title: `Wolfram|Alpha Result for "${query}"`,
            url: queryUrl,
            snippet: resultText,
            source_id: 'wolfram',
        }];
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Wolfram|Alpha call failed: ${errorMessage}`);
        // Return empty array on failure to not break the pipeline
        return [];
    }
}


export async function ingest_url(url: string): Promise<{ title: string; cleanedText: string }> {
  console.log(`Attempting to ingest URL: ${url}`);
  try {
    const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
    if (!response.ok) {
        throw new Error(`Fetch failed with status ${response.status}`);
    }
    const html = await response.text();
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : 'Untitled';

    const cleanedText = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        .replace(/<\/?[^>]+(>|$)/g, " ")
        .replace(/\s\s+/g, ' ')
        .trim();

    return { title, cleanedText };
  } catch (e) {
    console.error(`Ingest failed for ${url}`, e);
    // This will be caught by the browser's CORS policy before fetch is even made, resulting in a TypeError.
    // The AllOrigins proxy helps, but if it fails, we assume it's a CORS-like issue.
    throw new Error('CORS_BLOCKED');
  }
}

export async function extract_claims(model: string, text: string, sourceUrl: string): Promise<Evidence[]> {
    const prompt: Content[] = [{
        role: 'user', parts: [{ text: `Source URL: ${sourceUrl}\nText:\n---\n${text.substring(0, 30000)}\n---\nTASK: Extract key, testable claims. OUTPUT: A valid JSON array of objects, where each object has "id", "title" (the claim), "url", "snippet" (the evidence quote), and "source_id".` }]
    }];
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
            required: ['id', 'title', 'url', 'snippet', 'source_id']
        }
    };
    return callModelAPI<Evidence[]>(model, prompt, true, schema, undefined, 8192);
}

export function score_credibility(record: RecordLite): { score: number; breakdown: string[] } {
  let score = 0;
  const breakdown: string[] = [];
  const currentYear = new Date().getFullYear();

  // Handle Wolfram source separately
  if (record.source_id === 'wolfram') {
      return { score: 95, breakdown: ['High-confidence computational result from Wolfram|Alpha.']};
  }


  // 1. Recency (up to 40 pts)
  let recencyScore = 0;
  if (record.published) {
    const pubYear = new Date(record.published).getFullYear();
    if (pubYear && pubYear > 1970) {
      const age = Math.max(0, currentYear - pubYear);
      recencyScore = Math.max(0, 40 - (age * 4));
    }
  }
  score += recencyScore;
  breakdown.push(`Recency: ${recencyScore.toFixed(0)}/40`);
  
  // 2. Provenance (up to 25 pts)
  let provenanceScore = 5; // default for web source
  try {
    const domain = new URL(record.url).hostname;
    if (/\.gov$/.test(domain)) provenanceScore = 25;
    else if (/\.edu$/.test(domain)) provenanceScore = 22;
    else if (['nature.com', 'sciencemag.org', 'thelancet.com', 'nejm.org', 'arxiv.org', 'acm.org', 'ieee.org'].some(d => domain.includes(d))) provenanceScore = 25;
    else if (['reuters.com', 'apnews.com', 'bbc.com', 'wsj.com'].some(d => domain.includes(d))) provenanceScore = 20;
    else if (['wikipedia.org'].some(d => domain.includes(d))) provenanceScore = 10;
  } catch (e) {
    provenanceScore = 0;
  }
  score += provenanceScore;
  breakdown.push(`Provenance: ${provenanceScore.toFixed(0)}/25`);

  // 3. Relevance (up to 20 pts based on snippet length)
  let relevanceScore = 0;
  if (record.snippet && record.snippet.length > 50) {
      relevanceScore = Math.min(20, (record.snippet.length / 250) * 20);
  }
  score += relevanceScore;
  breakdown.push(`Relevance: ${relevanceScore.toFixed(0)}/20`);

  // 4. Completeness (up to 15 pts)
  let completenessScore = 0;
  if (record.title && record.title.toLowerCase() !== 'untitled' && record.title.toLowerCase() !== 'untitled search result' && record.title.length > 5) {
      completenessScore += 10;
  }
  if(record.url) {
      completenessScore += 5;
  }
  score += completenessScore;
  breakdown.push(`Completeness: ${completenessScore.toFixed(0)}/15`);

  return { score: Math.round(Math.min(100, score)), breakdown };
}

export function calculateHighValueScore(evidence: Evidence, allEvidence: Evidence[]): HighValueSource {
    const sTag = `[S${allEvidence.findIndex(e => e.id === evidence.id) + 1}]`;
    let score = 0;
    const reasons: string[] = [];
    const currentYear = new Date().getFullYear();

    // 1. Base credibility score (35%)
    const quantScore = evidence.quant_score || 50; // Default to 50 if no score
    score += quantScore * 0.35;
    reasons.push(`Credibility score: ${quantScore.toFixed(0)}`);

    // 2. Recency score (20%)
    let recencyScore = 0;
    if (evidence.year && evidence.year > 1970) {
        const age = Math.max(0, currentYear - evidence.year);
        recencyScore = Math.max(0, 100 - (age * 10)); // Harsh decay
        if(recencyScore > 50) reasons.push(`Recent (${evidence.year})`);
    }
    score += recencyScore * 0.20;
    
    // 3. Provenance score (20%)
    let provenanceScore = 50; // default for web source
    if (evidence.source_id === 'wolfram') {
        provenanceScore = 100;
        reasons.push('Computational result via Wolfram|Alpha');
    } else {
        try {
            const domain = new URL(evidence.url).hostname;
            if (/\.gov$/.test(domain)) { provenanceScore = 100; reasons.push('Official .gov source'); }
            else if (/\.edu$/.test(domain)) { provenanceScore = 90; reasons.push('Academic .edu source'); }
            else if (['nature.com', 'sciencemag.org', 'thelancet.com', 'nejm.org', 'arxiv.org', 'acm.org', 'ieee.org'].some(d => domain.includes(d))) { provenanceScore = 100; reasons.push('Peer-reviewed journal'); }
            else if (['reuters.com', 'apnews.com', 'bbc.com', 'wsj.com'].some(d => domain.includes(d))) { provenanceScore = 85; reasons.push('Reputable news source'); }
        } catch (e) {
            provenanceScore = 20;
        }
    }
    score += provenanceScore * 0.20;

    // 4. Independence penalty (10%)
    let independencePenalty = 0;
    try {
        if (evidence.source_id !== 'wolfram') {
            const domain = new URL(evidence.url).hostname.replace('www.', '');
            const sameDomainCount = allEvidence.filter(e => {
                try {
                    return e.source_id !== 'wolfram' && new URL(e.url).hostname.replace('www.', '') === domain;
                } catch { return false; }
            }).length;
            if (sameDomainCount > 1) {
                independencePenalty = Math.min(50, (sameDomainCount - 1) * 20);
                reasons.push(`One of ${sameDomainCount} sources from same domain`);
            }
        }
    } catch (e) {}
    score -= independencePenalty * 0.10;

    return {
        sTag,
        title: evidence.title,
        score: Math.round(Math.max(0, Math.min(100, score))),
        reasons,
    };
}


export function enforceCitationsAndUncertainties(result: InsightPackResult): InsightPackResult {
    const { markdown, uncertainties } = result.synthesisReport;
    if (!markdown) return result;

    const assertiveVerbs = ['is', 'are', 'was', 'were', 'proves', 'shows', 'demonstrates', 'indicates', 'confirms', 'establishes', 'does', 'suggests', 'means', 'causes', 'leads to', 'results in', 'has', 'will'];
    const sentenceRegex = /(?!.[()[]])([A-Z][^\.!\?]+[\.!\?])\s*/g;
    const citationRegex = /\[S\d+\]/;
    const verbalFillers = [/^In summary,/, /^Overall,/, /^This report shows/, /^To conclude,/, /^Finally,/i];

    let cleanMarkdown = markdown;
    let newUncertainties: string[] = [...(uncertainties || [])];
    let unsupportedClaims: string[] = [];

    // Extract unsupported claims from the main body
    const claims = markdown.match(sentenceRegex) || [];
    for (const claim of claims) {
        const hasAssertiveVerb = assertiveVerbs.some(verb => new RegExp(`\\b${verb}\\b`, 'i').test(claim));
        const hasCitation = citationRegex.test(claim);

        if (hasAssertiveVerb && !hasCitation && claim.length > 15) {
            unsupportedClaims.push(claim.trim());
        }
    }

    if (unsupportedClaims.length > 0) {
        // Remove from original markdown
        unsupportedClaims.forEach(claim => {
            cleanMarkdown = cleanMarkdown.replace(claim, '');
        });

        const newUncertaintyText = unsupportedClaims.map(claim => `- Could not verify: "${claim}"`).join('\n');
        
        // Find "Unknowns / gaps" section and append
        const gapsHeaderRegex = /(Unknowns \/ gaps|What is uncertain or missing|7\) Unknowns \/ gaps)/i;
        if (gapsHeaderRegex.test(cleanMarkdown)) {
            cleanMarkdown = cleanMarkdown.replace(gapsHeaderRegex, match => `${match}\n${newUncertaintyText}`);
        } else {
            // If header not found, add it
            cleanMarkdown += `\n\n- Unknowns / gaps\n${newUncertaintyText}`;
        }
        
        // Add to uncertainties array as well
        newUncertainties.push(...unsupportedClaims.map(c => `Could not verify: "${c}"`));
    }

    // Trim verbal fillers
    verbalFillers.forEach(filler => {
        cleanMarkdown = cleanMarkdown.replace(filler, '').trim();
    });

    // Clean up excessive newlines
    cleanMarkdown = cleanMarkdown.replace(/(\r\n|\n){3,}/g, '\n\n').trim();

    return {
        ...result,
        synthesisReport: {
            ...result.synthesisReport,
            markdown: cleanMarkdown,
            uncertainties: [...new Set(newUncertainties)], // Dedupe
        }
    };
}

export function postProcessFinalAnswer(result: FinalAnswererResult): FinalAnswererResult {
    const { markdown_body, uncertainties } = result;
    if (!markdown_body) return result;

    const assertiveVerbs = ['is', 'are', 'was', 'were', 'proves', 'shows', 'demonstrates', 'indicates', 'confirms', 'establishes', 'does', 'suggests', 'means', 'causes', 'leads to', 'results in', 'has', 'will', 'must', 'should', 'can', 'could'];
    // This regex tries to capture sentences, including those in markdown lists.
    const sentenceRegex = /(?:^|\n)\s*([*-]?\s*[A-Z][^.!?]+[.!?])/g;
    const citationRegex = /\[S\d+\]/g; // Use global flag to check for any citation

    let cleanMarkdown = markdown_body;
    const newUncertainties: string[] = [...(uncertainties || [])];
    const unsupportedClaims: string[] = [];

    // Use replace with a function which is great for this kind of work.
    cleanMarkdown = markdown_body.replace(sentenceRegex, (match, sentence) => {
        if (!sentence) return match;

        // Reset regex state for citation check
        citationRegex.lastIndex = 0;
        const hasCitation = citationRegex.test(sentence);
        if (hasCitation) {
            return match; // It has a citation, so we leave it.
        }

        const hasAssertiveVerb = assertiveVerbs.some(verb => new RegExp(`\\b${verb}\\b`, 'i').test(sentence));
        
        // A simple heuristic to avoid flagging section headers
        const isLikelyHeader = sentence.trim().split(' ').length < 5 && !sentence.trim().endsWith('.');

        if (hasAssertiveVerb && !isLikelyHeader && sentence.length > 20) {
            // It's an unsupported assertive claim.
            unsupportedClaims.push(sentence.trim().replace(/^[*-]\s*/, ''));
            return ''; // Remove it from the markdown body.
        }

        // It's not an assertive claim, or it's too short, or it looks like a header. Keep it.
        return match;
    });

    if (unsupportedClaims.length > 0) {
        newUncertainties.push(...unsupportedClaims);
    }

    // Clean up excessive newlines that might result from removals.
    cleanMarkdown = cleanMarkdown.replace(/(\r\n|\n){3,}/g, '\n\n').trim();

    return {
        ...result,
        markdown_body: cleanMarkdown,
        uncertainties: [...new Set(newUncertainties)], // Deduplicate
    };
}

export function deduplicateRecords(records: RecordLite[]): RecordLite[] {
    const seenUrls = new Set<string>();
    const uniqueRecords: RecordLite[] = [];
    for (const record of records) {
        if (record.url && !seenUrls.has(record.url)) {
            seenUrls.add(record.url);
            uniqueRecords.push(record);
        }
    }
    return uniqueRecords;
}