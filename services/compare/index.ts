import { normalizeClaims, SourceRecord, NormalizedClaim } from './normalize';
import { agree, AgreementLabel } from './agree';

export type Agreement = {
  a: string;
  b: string;
  label: AgreementLabel;
  confidence: number;
};

export type ComparisonMatrix = {
  claims: NormalizedClaim[];
  agreements: Agreement[];
};

export async function buildComparisonMatrix(records: SourceRecord[]): Promise<ComparisonMatrix> {
  const claims = normalizeClaims(records);
  const agreements: Agreement[] = [];
  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const res = await agree(claims[i].canonical, claims[j].canonical);
      agreements.push({
        a: claims[i].id,
        b: claims[j].id,
        label: res.label,
        confidence: res.confidence,
      });
    }
  }
  return { claims, agreements };
}

export type { SourceRecord } from './normalize';
