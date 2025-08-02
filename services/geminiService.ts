// services/geminiService.ts
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
import { TIMEOUTS } from '../constants';
import { SYSTEM_GUARDRAILS } from '../prompts/system';
import * as AgentPrompts from '../prompts/agents';

/**
 * TODO: Replace this stub with the real @google/generative-ai client wiring.
 * I need you to open and paste the relevant exported types/signatures from:
 *   node_modules/@google/generative-ai/dist/index.d.ts
 * (or the equivalent entry .d.ts) so I can update this to call the real SDK.
 */

// Simple delay helper for simulating async work.
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const logAPICall = (model: string, start_ts: number) => {
  const end_ts = Date.now();
  console.log({
    event: 'gemini_call_completed_stub',
    model,
    start_ts,
    end_ts,
    duration_ms: end_ts - start_ts,
  });
};

// Retry wrapper (simple)
async function retry<T>(op: () => Promise<T>, tries: number = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      return await op();
    } catch (e) {
      lastErr = e;
      console.warn(`Stub attempt ${i + 1} failed, retrying...`, e);
      await delay(500 * (i + 1));
    }
  }
  throw lastErr;
}

/**
 * Placeholder for the real callModelAPI.
 * Returns dummy or throws depending on context.
 */
export async function callModelAPI<T>(
  modelName: string,
  contents: any[],
  isJson: boolean,
  schema?: any,
  tools?: any[],
  maxOutputTokens?: number,
): Promise<T> {
  const start_ts = Date.now();
  logAPICall(modelName, start_ts);

  console.warn(
    '[STUB] callModelAPI invoked. Replace with real @google/generative-ai implementation.',
    { modelName, contents, isJson, schema, tools, maxOutputTokens },
  );

  // Simulate latency
  await delay(200);

  // If expecting non-JSON (e.g., free text), return a placeholder string
  if (!isJson) {
    return `Stub response for model ${modelName}` as unknown as T;
  }

  // If expecting structured JSON, attempt to return a minimal shape matching known types
  // For deep research result, answerer, etc., return empty defaults that satisfy the shape partially
  const dummy: any = {};

  return dummy as T;
}

// --- Higher-level agent wrappers using stubbed callModelAPI ---

export const runResearchSynthesisAgent = async (
  model: string,
  facetSummaries: string,
  sources: RecordLite[],
): Promise<DeepResearchResult> => {
  const promptText = AgentPrompts.getResearchSynthesisAgentPrompt(facetSummaries, sources);
  const prompt = [{ role: 'user', parts: [{ text: promptText }] }];

  return retry(() =>
    callModelAPI<DeepResearchResult>(
      model,
      prompt,
      true,
      undefined,
      undefined,
      16384,
    ),
  );
};

export const runScreeningAgent = async (
  model: string,
  records: RecordLite[],
  brief: ResearchBrief,
): Promise<{ kept: Evidence[]; dropped_count: number }> => {
  const promptText = AgentPrompts.getScreeningAgentPrompt(records, brief);
  const prompt = [{ role: 'user', parts: [{ text: promptText }] }];

  return retry(() =>
    callModelAPI<{ kept: Evidence[]; dropped_count: number }>(
      model,
      prompt,
      true,
      undefined,
      undefined,
      8192,
    ),
  );
};

export const runInsightPackAgent = async (
  model: string,
  job: ResearchJob,
): Promise<InsightPackResult> => {
  const promptText = AgentPrompts.getInsightPackAgentPrompt(job);
  const prompt = [{ role: 'user', parts: [{ text: promptText }] }];

  return retry(() =>
    callModelAPI<InsightPackResult>(
      model,
      prompt,
      true,
      undefined,
      undefined,
      16384,
    ),
  );
};

export const runAnswererAgent = async (
  model: string,
  job: ResearchJob,
): Promise<FinalAnswererResult> => {
  const promptText = AgentPrompts.getAnswererAgentPrompt(job);
  const prompt = [{ role: 'user', parts: [{ text: promptText }] }];

  return retry(() =>
    callModelAPI<FinalAnswererResult>(
      model,
      prompt,
      true,
      undefined,
      undefined,
      16384,
    ),
  );
};

export const runFollowUpChat = async (
  model: string,
  job: ResearchJob,
  history: ChatMessage[],
  newQuestion: string,
): Promise<string> => {
  const promptText = AgentPrompts.getFollowUpChatPrompt(job, history, newQuestion);
  const prompt = [{ role: 'user', parts: [{ text: promptText }] }];

  return retry(() =>
    callModelAPI<string>(model, prompt, false, undefined, undefined, 4096),
  );
};