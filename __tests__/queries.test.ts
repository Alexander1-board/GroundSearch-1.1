import { describe, it, expect } from 'vitest';
import { build_queries } from '../services/tools/queries';
import { ResearchBrief } from '../types';

describe('build_queries', () => {
  it('builds semantic queries using objective', () => {
    const brief: ResearchBrief = {
      objective: 'study cats',
      key_questions: [],
      scope: { timeframe: { from: 2020, to: 2024 }, domains: [], comparators: [] },
      deliverable: '',
      success_criteria: [],
    };
    const queries = build_queries('web', brief);
    expect(queries[0]).toContain('study cats');
  });
});
