import { ResearchBrief } from '../../types';

export function build_queries(source: string, brief: ResearchBrief): string[] {
  const base = brief.objective || 'research';
  return [`${base} ${source}`];
}
