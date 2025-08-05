import type { SourceRecord } from '../compare';

export type SynthesisOutput = {
  summary: string; // includes [S#] markers
  agreements: string[];
  contradictions: string[];
  caveats: string[];
  sources: SourceRecord[];
};

export function exportMarkdown(synth: SynthesisOutput): string {
  const lines: string[] = [];
  lines.push('# Executive Summary');
  lines.push(synth.summary);
  lines.push('');
  if (synth.agreements.length) {
    lines.push('## Agreements');
    synth.agreements.forEach((a) => lines.push(`- ${a}`));
    lines.push('');
  }
  if (synth.contradictions.length) {
    lines.push('## Contradictions');
    synth.contradictions.forEach((c) => lines.push(`- ${c}`));
    lines.push('');
  }
  if (synth.caveats.length) {
    lines.push('## Caveats');
    synth.caveats.forEach((c) => lines.push(`- ${c}`));
    lines.push('');
  }
  lines.push('## Sources');
  synth.sources.forEach((s, idx) => {
    lines.push(`[S${idx + 1}]: ${s.title} (${s.url})`);
  });
  return lines.join('\n');
}
