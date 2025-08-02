import { describe, it, expect } from 'vitest';
import { propose_source_plan } from '../services/tools/planning';
import { ResearchBrief } from '../types';

describe('propose_source_plan', () => {
  it('returns source plans including objective text', () => {
    const brief: ResearchBrief = {
      objective: 'study cats',
      key_questions: ['why purr'],
      scope: { timeframe: { from: 2020, to: 2024 }, domains: [], comparators: [] },
      deliverable: '',
      success_criteria: [],
    };
    const plan = propose_source_plan(brief);
    expect(plan.length).toBeGreaterThan(0);
    expect(plan[0]).toHaveProperty('source');
    expect(plan[0].queryTemplate).toContain('study cats');
  });
});
