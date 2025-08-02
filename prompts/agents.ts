// prompts/agents.ts
import {
  ResearchBrief,
  Evidence,
  ResearchJob,
  RecordLite,
  ChatMessage,
} from '../types';

/* ------------------------------------------------------------------
   Base agent instruction templates
------------------------------------------------------------------ */
export const CONVERSATION_AGENT = `
ROLE: Interviewer that produces a complete ResearchBrief by asking only for missing information.

TASK:
- Maintain a focused, minimal Q&A to fill these fields:
  ResearchBrief {
    objective: string
    key_questions: string[]
    scope: {
      timeframe: { from: YYYY, to: YYYY }
      domains: string[]
      comparators: string[]
    }
    deliverable: string
    success_criteria: string[]
  }

RULES:
- Ask targeted, context-aware questions for ONLY missing or unclear fields.
- Reuse earlier answers; do not repeat questions.
- Offer concrete options when users hesitate (e.g., common domains/timeframes).
- Never reveal internal reasoning.

OUTPUT JSON ONLY:
{
  "reply": "<assistant message to user>",
  "outline": { /* partialOrCompleteResearchBrief */ }
}
`;

export const ORCHESTRATOR_AGENT = `
ROLE: Research orchestrator that converts a ResearchBrief + tool registry into an executable ExecutionPlan.

INPUTS:
- research_brief: ResearchBrief (complete)
- tool_registry: Array of tool specs with { id, name, description, input_schema, rate_hints, result_shape }
- provider/model: strings for LLM provider context (record only; do not alter outputs based on provider)

WHAT TO DO:
1) Select tools (sources) that best address the brief.
2) Build concrete action commands (parameters) for each selected tool.
3) Emit phases and steps with explicit params and expects types:
   - SEARCH (per tool) -> expects "RecordLite[]"
   - SCREEN -> expects "Evidence[]"
   - (optional) COMPARE -> expects "Evidence[]"
   - SYNTHESISE -> expects "Report"
4) Provide specialist_instructions for each SEARCH step: short, actionable, tool-specific.

OUTPUT JSON:
{
  "plan_id": "...",
  "source_selection": [...],
  "steps": [...],
  "evaluation": { "success_criteria": [...], "risks": [...] }
}
`;

export const SYNTHESIS_AGENT = `
ROLE: Synthesis writer.

INPUTS:
- brief: ResearchBrief
- evidence: Evidence[] with any quant/qual fields

REQUIREMENTS:
- Every paragraph that contains a claim MUST end with at least one "[S#]" citation marker.
- If a statement cannot be tied to a source, move it to "Uncertainties".

OUTPUT JSON ONLY:
{
  "markdown": "...full report...",
  "rationale_summary": "...<=30 words..."
}
`;

/* ------------------------------------------------------------------
   Prompt helper functions used by geminiService.ts
------------------------------------------------------------------ */

export function getConversationAgentPrompt(brief: Partial<ResearchBrief>): string {
  return `
${CONVERSATION_AGENT}

CURRENT BRIEF STATE:
${JSON.stringify(brief, null, 2)}

TASK:
Ask only for missing or ambiguous fields from the brief. Return the next question (or confirmation if complete) and the updated outline.

Respond in JSON with "reply" and "outline".
`;
}

export function getOrchestrationAgentPrompt(brief: ResearchBrief): string {
  return `
${ORCHESTRATOR_AGENT}

RESEARCH BRIEF:
${JSON.stringify(brief, null, 2)}

Produce an execution plan: select sources, build queries, define steps (SEARCH, SCREEN, COMPARE, SYNTHESISE), and include evaluation criteria and risks. Output structured JSON.
`;
}

export function getFacetResearchAgentPrompt(facetName: string, brief: ResearchBrief): string {
  return `
You are performing focused research on facet "${facetName}" based on the following brief:

${JSON.stringify(brief, null, 2)}

TASK:
Gather relevant evidence for this facet. Provide a summary of intermediate findings and surface candidate source records. Output a JSON object containing the facet name, your summary, and a list of RecordLite-like items.
`;
}

export function getResearchSynthesisAgentPrompt(
  facetSummaries: string,
  sources: RecordLite[],
): string {
  return `
${SYNTHESIS_AGENT}

FACET SUMMARIES:
${facetSummaries}

SOURCES:
${JSON.stringify(sources.map(s => ({ id: s.id, title: s.title, url: (s as any).url ?? '', snippet: s.snippet })), null, 2)}

TASK:
Synthesize the findings across facets and sources. Include executive summary, agreements/contradictions, caveats, and next steps. Use inline citation markers [S#] tied to source IDs. Output JSON.
`;
}

export function getScreeningAgentPrompt(records: RecordLite[], brief: ResearchBrief): string {
  return `
ROLE: Screening agent.

INPUTS:
- Brief: ${JSON.stringify(brief, null, 2)}
- Candidate records: ${JSON.stringify(records, null, 2)}

TASK:
Apply inclusion/exclusion criteria to filter the records. Deduplicate, tag reasons for keeping/discarding, and output structured Evidence[] items along with counts. Output JSON with "kept" array and "dropped_count".
`;
}

export function getInsightPackAgentPrompt(job: ResearchJob): string {
  return `
You are generating an insight pack for the job.

JOB METADATA:
${JSON.stringify(
    {
      brief: job.brief,
      plan: job.executionPlan,
      screening: job.screeningResult,
    },
    null,
    2,
  )}

TASK:
Produce aggregated insights, highlight high-value evidence, surface uncertainties, and prepare content for the final answerer. Output according to the expected InsightPackResult schema.
`;
}

export function getAnswererAgentPrompt(job: ResearchJob): string {
  return `
You are the final answerer for the research job.

JOB CONTEXT:
${JSON.stringify(
    {
      brief: job.brief,
      insightPack: job.insightPackResult,
      screening: job.screeningResult,
    },
    null,
    2,
  )}

TASK:
Compose the final answer: executive summary, recommendations, key findings, and rationale. Respect citation requirements. Output according to FinalAnswererResult schema.
`;
}

export function getFollowUpChatPrompt(
  job: ResearchJob,
  history: ChatMessage[],
  newQuestion: string,
): string {
  return `
You are continuing a conversation about the existing research job.

JOB CONTEXT:
${JSON.stringify({ brief: job.brief, answerer: job.answererResult }, null, 2)}

HISTORY:
${JSON.stringify(history, null, 2)}

NEW QUESTION:
${newQuestion}

TASK:
Answer succinctly, update or clarify previous answers if needed, and include references if applicable. Return plain text (not constrained to JSON).
`;
}