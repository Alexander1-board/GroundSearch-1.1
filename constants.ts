

import { ResearchBrief, ResearchJob, AppConfig } from './types';

export const REASONING_MODELS = ['gemini-2.5-flash'];
export const TOOL_MODELS = ['gemini-2.5-flash'];

export const EMPTY_BRIEF: ResearchBrief = {
  objective: '',
  key_questions: [],
  scope: {
    timeframe: { from: new Date().getFullYear() - 5, to: new Date().getFullYear() },
    domains: [],
    comparators: [],
    geography: '',
  },
  deliverable: 'A cited narrative report with a comparison matrix.',
  success_criteria: [],
  assumptions: [],
};

export const createNewJob = (config: AppConfig): ResearchJob => ({
  id: `job-${Date.now()}`,
  title: 'Untitled Research Job',
  status: 'Draft',
  models: {
      reasoning: config.reasoningModel,
      tool: config.toolModel,
  },
  config: {
      allowToolPlanFallback: config.allowToolPlanFallback,
      isWolframEnabled: config.isWolframEnabled,
      wolframAppId: config.wolframAppId,
  },
  brief: { ...EMPTY_BRIEF },
  chatHistory: [{
      role: 'model',
      parts: [{ text: "Hello! I'm here to help you scope your research. What is the main objective of your research?" }]
  }],
  followUpHistory: [],
  sources: [],
  evidence: [],
  insightPackResult: undefined,
  facetResults: {},
});


export const TIMEOUTS = {
  plan: 60000,
  synthesis: 180000,
  compare: 120000,
  toolSearch: 90000,
  extract: 90000,
  conversation: 60000,
  insightPack: 300000, // Longer timeout for the combined agent
};