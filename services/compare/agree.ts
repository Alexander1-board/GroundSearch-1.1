import { ai } from '../geminiService';
import type { AgreementLabel } from './types';

export type { AgreementLabel } from './types';

function heuristic(a: string, b: string): { label: AgreementLabel; confidence: number } {
  const norm = (s: string) => s.toLowerCase();
  const hasNegA = /\b(not|no|never)\b/.test(norm(a));
  const hasNegB = /\b(not|no|never)\b/.test(norm(b));
  const wordsA = new Set(
    norm(a)
      .split(/\W+/)
      .filter((w) => w),
  );
  const wordsB = new Set(
    norm(b)
      .split(/\W+/)
      .filter((w) => w),
  );
  const overlap = [...wordsA].filter((w) => wordsB.has(w) && w.length > 3);
  if (overlap.length === 0) return { label: 'neutral', confidence: 0.3 };
  if (hasNegA !== hasNegB) return { label: 'contradicts', confidence: 0.6 };
  return { label: 'supports', confidence: 0.6 };
}

export async function agree(
  a: string,
  b: string,
): Promise<{ label: AgreementLabel; confidence: number }> {
  try {
    const model = ai.getGenerativeModel({ model: 'gemini-pro' });
    const prompt =
      'Compare the two claims and respond as JSON {"label":"supports|contradicts|neutral","confidence":0-1}.\nA: ' +
      a +
      '\nB: ' +
      b;
    const res = await model.generateContent(prompt);
    const text = res.response?.text();
    if (text) {
      const parsed = JSON.parse(text);
      if (parsed.label) return parsed;
    }
  } catch {
    // ignore and fall back
  }
  return heuristic(a, b);
}
