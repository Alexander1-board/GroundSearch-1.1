import type { SourceRecord, ComparisonMatrix } from './services/compare';
import type { SynthesisOutput } from './services/export/markdown';

export type ResearchBrief = {
  objective: string;
  key_questions: string[];
  scope: {
    timeframe: { from: number; to: number };
    domains: string[];
    comparators: string[];
    geography?: string;
  };
  deliverable: string;
  success_criteria: string[];
  assumptions?: string[];
  inferred_fields?: string[];
};

export type RecordLite = {
  id: string;
  title: string;
  url: string;
  snippet?: string;
  published?: number;
  source_id: string;
  metadata?: Record<string, any>;
};

export type Evidence = {
  id: string;
  title: string;
  url: string;
  year?: number;
  key_outcome?: string;
  sample_size?: number;
  citation_count?: number;
  source_id: string;
  snippet?: string;
  notes?: string[];
  quant_score?: number;
  qual?: {
    rigor?: number;
    bias?: number;
    relevance?: number;
    clarity?: number;
    justification?: string;
  };
  matches_questions?: boolean;
  within_timeframe?: boolean;
  has_comparators?: boolean;
  has_quant_outcomes?: boolean;
};

// --- New Insight Pack Types ---
// Refactored to use arrays of objects to satisfy stricter Gemini schema validation.

export type ThemeRelationDetails = {
  relation: 'supports' | 'contradicts' | 'neutral';
  note: string;
  evidence_ids: string[];
};

export type Theme = {
  name: string;
  conflict_score: number;
  corroboration_count?: number;
  contradiction_count?: number;
  relations: { platform: string; details: ThemeRelationDetails }[];
};

export type InsightPackComparisonResult = {
  themes: Theme[];
};

// This is now an intermediate product for the Answerer Agent
export type InsightPackSynthesisReport = {
  markdown: string; // Intermediate analysis notes/summary
  rationale_summary: string;
  uncertainties?: string[]; // Kept for the enforceCitations tool
};

export type NextStep = {
  description: string;
  search_query: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
};

export type SourceAnalysis = {
  source_id: string;
  role: 'primary' | 'official' | 'peer_reviewed' | 'reputable_media' | 'blog' | 'forum';
  provenance_hints: string;
};

export type MetaTrace = {
  high_conflict_themes: string[];
  sparse_evidence_themes: string[];
  platform_source_counts: { platform: string; count: number }[];
  source_analysis?: SourceAnalysis[];
};

export type InsightPackResult = {
  comparisonResult: InsightPackComparisonResult;
  synthesisReport: InsightPackSynthesisReport;
  nextSteps: NextStep[];
  brief_refinements: string[];
  meta_trace: MetaTrace;
};

export type HighValueSource = {
  sTag: string;
  title: string;
  score: number;
  reasons: string[];
};

// --- Final Answerer Agent Types ---

export type ThemeConfidence = {
  theme: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  sources: string[];
};

export type HighValueSourceReason = {
  id: string;
  why: string;
};

export type FinalAnswererResult = {
  answer: string;
  markdown_body: string;
  theme_confidences: ThemeConfidence[];
  next_steps: string[];
  high_value_sources: HighValueSourceReason[];
  uncertainties: string[];
  rationale_summary: string;
};

// --- Deep Research Types ---
export type FacetClaim = {
  summary: string;
  source_ids: string[];
  confidence: 'high' | 'medium' | 'low';
  why_high_value: string;
};

export type FacetResult = {
  claims: FacetClaim[];
  coverage: 'direct' | 'indirect' | 'none';
  tried: {
    queries: string[];
    auxiliary: string[]; // e.g., 'whois', 'archive', 'social'
  };
  note_if_missing?: string;
};

export type DeepResearchResult = {
  facet_results: {
    governance: FacetResult;
    ownership: FacetResult;
    control: FacetResult;
    decentralization_claims: FacetResult;
    technical_architecture: FacetResult;
  };
  overall_assessment: string;
  sources: RecordLite[];
};

// --- End Insight Pack Types ---

export type ExecutionStep = {
  id: string;
  agent: string;
  action:
    | 'SEARCH'
    | 'SCREEN'
    | 'COMPARE'
    | 'ANSWER'
    | 'INGEST'
    | 'RESEARCH_FACET'
    | 'SYNTHESIZE_RESEARCH';
  params: Record<string, any>;
  expects:
    | 'RecordLite[]'
    | 'Evidence[]'
    | 'Report'
    | 'FinalAnswer'
    | 'FacetResult'
    | 'DeepResearchResult';
  specialist_instructions?: string;
  status: 'Pending' | 'Running' | 'Completed' | 'Failed' | 'CORS_BLOCKED';
  result?: any;
  duration?: number;
};

export type ExecutionPlan = {
  plan_id: string;
  rationale_summary: string;
  source_selection: string[];
  steps: ExecutionStep[];
  evaluation: {
    success_criteria: string[];
    risks: string[];
  };
};

export type AppConfig = {
  reasoningModel: string;
  toolModel: string;
  allowToolPlanFallback: boolean;
  isWolframEnabled: boolean;
  wolframAppId: string;
};

export type ResearchJob = {
  id: string;
  title: string;
  status: JobStatus;
  models: { reasoning: string; tool: string };
  config: Omit<AppConfig, 'reasoningModel' | 'toolModel'>; // Job-specific config snapshot
  brief?: ResearchBrief;
  plan?: ExecutionPlan;
  sources?: RecordLite[];
  evidence?: Evidence[];
  insightPackResult?: InsightPackResult;
  answererResult?: FinalAnswererResult;
  deepResearchResult?: DeepResearchResult;
  facetResults?: { [key: string]: FacetResult };
  chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[];
  followUpHistory: ChatMessage[];
  lastError?: string;
  resultsView?: 'report' | 'matrix';
};

export type ChatMessage = {
  role: 'user' | 'model';
  text: string;
};

export type TraceEvent = {
  step_id: string;
  parent_step_id?: string;
  action: ExecutionStep['action'] | 'TOOL_CALL' | 'TOOL_RESPONSE' | 'INFO' | 'ERROR';
  agent?: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'info';
  model?: string;
  start_ts: number;
  end_ts?: number;
  duration_ms?: number;
  summary: string;
  input_snapshot?: any;
  output_snapshot?: any;
  fallback_used?: boolean;
  error?: string;
  recommendation?: string;
};

// --- Job Versioning ---

export type JobStatus =
  | 'Draft'
  | 'Planning'
  | 'Running'
  | 'Comparing'
  | 'Answering'
  | 'Synthesizing'
  | 'Complete'
  | 'Error';

export type JobSnapshot = {
  prePrompt: string;
  brief: ResearchBrief;
  sourcePlan?: any;
  sourceRecords?: SourceRecord[];
  comparisonMatrix?: ComparisonMatrix;
  synthesis?: SynthesisOutput;
  markdown?: string;
  status: JobStatus;
};

export type JobVersion = {
  version: number;
  timestamp: number;
  snapshot: JobSnapshot;
};

export type Job = {
  id: string;
  versions: JobVersion[];
};
