import { describe, it, expect } from 'vitest';
import { score_sources } from '../services/tools/scoring';
import { RecordLite } from '../types';

describe('score_sources', () => {
  it('scores records with recency and peer review', () => {
    const records: RecordLite[] = [
      {
        id: '1',
        title: '',
        url: '',
        source_id: 'web',
        published: 2023,
        metadata: { peer_reviewed: true },
      },
    ];
    const scores = score_sources(records, ['credibility']);
    expect(scores[0].id).toBe('1');
    expect(typeof scores[0].score).toBe('number');
  });
});
