import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import PrePromptPanel from '../components/PrePromptPanel';
import ScopingAgent from '../components/ScopingAgent';
import { createJob, loadJob, loadJobVersions, saveJobVersion } from '../store/jobs';
import { propose_source_plan } from '../services/tools/planning';
import { build_queries } from '../services/tools/queries';
import { score_sources } from '../services/tools/scoring';
import { buildComparisonMatrix, SourceRecord } from '../services/compare';
import { exportMarkdown, SynthesisOutput } from '../services/export/markdown';
import type { RecordLite, ResearchBrief } from '../types';

const fillBrief = (jobId: string) => {
  render(<ScopingAgent jobId={jobId} />);
  fireEvent.change(screen.getByLabelText('objective'), { target: { value: 'Study cats' } });
  fireEvent.click(screen.getByText('Next'));
  fireEvent.change(screen.getByLabelText('key-questions'), {
    target: { value: 'Are cats friendly?' },
  });
  fireEvent.click(screen.getByText('Next'));
  fireEvent.change(screen.getByLabelText('comparators'), { target: { value: 'dogs' } });
  fireEvent.click(screen.getByText('Next'));
  fireEvent.change(screen.getByLabelText('from'), { target: { value: '2020' } });
  fireEvent.change(screen.getByLabelText('to'), { target: { value: '2024' } });
  fireEvent.click(screen.getByText('Next'));
  fireEvent.change(screen.getByLabelText('deliverable'), { target: { value: 'Report' } });
  fireEvent.click(screen.getByText('Next'));
  fireEvent.change(screen.getByLabelText('success-criteria'), {
    target: { value: 'Clear answer' },
  });
  screen.getByTestId('summary');
};

describe('golden path', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('runs end-to-end with versioning and markdown export', async () => {
    const jobId = 'golden1';
    createJob(jobId);

    render(<PrePromptPanel jobId={jobId} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Be concise' } });
    fireEvent.click(screen.getByText('Save'));

    fillBrief(jobId);

    const versionsAfterBrief = loadJobVersions(jobId);
    expect(versionsAfterBrief.length).toBeGreaterThan(2);

    const brief: ResearchBrief = loadJob(jobId).brief;
    const plan = propose_source_plan(brief);
    const queries = build_queries(plan[0].source, brief);
    const records: RecordLite[] = [
      { id: 'a', title: 'A', url: 'a', source_id: 'web', snippet: '', published: 2024 },
      { id: 'b', title: 'B', url: 'b', source_id: 'web', snippet: '', published: 2023 },
    ];
    const scores = score_sources(records, ['credibility']);
    const sourceRecords: SourceRecord[] = [
      {
        id: 'a',
        title: 'A',
        url: 'a',
        claim: 'Cats are friendly animals',
        credibility: scores[0].score,
      },
      {
        id: 'b',
        title: 'B',
        url: 'b',
        claim: 'Cats are not friendly animals',
        credibility: scores[1].score,
      },
    ];
    saveJobVersion(jobId, { sourcePlan: plan, sourceRecords, status: 'Planning' });

    const matrix = await buildComparisonMatrix(sourceRecords);
    expect(matrix.agreements[0].label).toBe('contradicts');
    saveJobVersion(jobId, { comparisonMatrix: matrix, status: 'Comparing' });

    const synth: SynthesisOutput = {
      summary: 'Source A says cats are friendly [S1]; source B disagrees [S2]',
      agreements: [],
      contradictions: ['A and B disagree about cats [S1][S2]'],
      caveats: [],
      sources: sourceRecords,
    };
    const markdown = exportMarkdown(synth);
    saveJobVersion(jobId, { synthesis: synth, markdown, status: 'Complete' });

    const final = loadJob(jobId);
    expect(final.status).toBe('Complete');
    expect(markdown).toContain('[S1]');
    expect(markdown).toContain('[S2]');
    expect(markdown).toContain('## Sources');

    const versions = loadJobVersions(jobId);
    expect(versions.length).toBeGreaterThan(4);

    console.log('JOB_SNAPSHOT', JSON.stringify({ id: jobId, versions }, null, 2));
    console.log('MARKDOWN_OUTPUT\n' + markdown);
  });
});
