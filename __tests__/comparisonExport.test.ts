import { describe, it, expect } from 'vitest';
import { buildComparisonMatrix, SourceRecord } from '../services/compare';
import { exportMarkdown, SynthesisOutput } from '../services/export/markdown';

describe('comparison matrix and markdown export', () => {
  it('detects contradictions and exports citations', async () => {
    const sources: SourceRecord[] = [
      { id: '1', title: 'Study A', url: 'http://a', claim: 'Cats are mammals', credibility: 0.9 },
      {
        id: '2',
        title: 'Study B',
        url: 'http://b',
        claim: 'Cats are not mammals',
        credibility: 0.8,
      },
    ];
    const matrix = await buildComparisonMatrix(sources);
    const pair = matrix.agreements.find(
      (p) => (p.a === '1' && p.b === '2') || (p.a === '2' && p.b === '1'),
    );
    expect(pair?.label).toBe('contradicts');

    const summary = 'Cats are mammals [S1] but some claim otherwise [S2].';
    const synth: SynthesisOutput = {
      summary,
      agreements: [],
      contradictions: ['Conflicting classification of cats'],
      caveats: [],
      sources,
    };
    const markdown = exportMarkdown(synth);
    expect((summary.match(/\[S\d+\]/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(markdown).toContain(summary);
    expect(markdown).toContain('[S1]: Study A');
    expect(markdown).toContain('[S2]: Study B');
  });
});
