import { ResearchBrief } from '../../types';

export type SourcePlan = { source: string; queryTemplate: string };

export function propose_source_plan(brief: ResearchBrief): SourcePlan[] {
  return [
    { source: 'scholar', queryTemplate: brief.objective || 'latest research' },
    { source: 'web', queryTemplate: brief.key_questions[0] || brief.objective },
  ];
}
