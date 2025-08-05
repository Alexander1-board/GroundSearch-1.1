import { RecordLite } from '../../types';

type Scored = { id: string; score: number };

export function score_sources(records: RecordLite[], criteria: string[]): Scored[] {
  const currentYear = new Date().getFullYear();
  return records.map((r) => {
    const recency = r.published ? Math.max(0, currentYear - r.published) : 5;
    const peer = r.metadata && r.metadata.peer_reviewed ? 1 : 0;
    const base = criteria.includes('credibility') ? 10 : 5;
    const score = base - recency + peer;
    return { id: r.id, score };
  });
}
