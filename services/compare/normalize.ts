export type SourceRecord = {
  id: string;
  title: string;
  url: string;
  claim: string;
  credibility?: number;
  metadata?: Record<string, any>;
};

export type NormalizedClaim = {
  id: string;
  text: string;
  canonical: string;
  credibility: number;
  source: SourceRecord;
};

export const normalizeClaims = (records: SourceRecord[]): NormalizedClaim[] => {
  return records.map((r) => ({
    id: r.id,
    text: r.claim,
    canonical: r.claim
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim(),
    credibility: r.credibility ?? 0,
    source: r,
  }));
};
