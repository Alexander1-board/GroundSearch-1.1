import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import ScopingAgent from '../components/ScopingAgent';
import { loadBrief, resetBrief, loadJobVersions } from '../store/jobs';

const jobId = 'job-test';

describe('ScopingAgent', () => {
  beforeEach(() => {
    localStorage.clear();
    resetBrief(jobId);
  });

  it('collects brief fields and persists versions', () => {
    render(<ScopingAgent jobId={jobId} />);

    fireEvent.change(screen.getByLabelText('objective'), { target: { value: 'Improve health' } });
    fireEvent.click(screen.getByText('Next'));

    fireEvent.change(screen.getByLabelText('key-questions'), {
      target: { value: 'What is effect?\nHow fast?' },
    });
    fireEvent.click(screen.getByText('Next'));

    fireEvent.change(screen.getByLabelText('comparators'), {
      target: { value: 'A\nB' },
    });
    fireEvent.click(screen.getByText('Next'));

    fireEvent.change(screen.getByLabelText('from'), { target: { value: '2010' } });
    fireEvent.change(screen.getByLabelText('to'), { target: { value: '2020' } });
    fireEvent.click(screen.getByText('Next'));

    fireEvent.change(screen.getByLabelText('deliverable'), { target: { value: 'Report' } });
    fireEvent.click(screen.getByText('Next'));

    fireEvent.change(screen.getByLabelText('success-criteria'), {
      target: { value: 'Accuracy\nSpeed' },
    });
    expect(screen.getByTestId('summary')).toBeInTheDocument();

    const brief = loadBrief(jobId);
    expect(brief.objective).toBe('Improve health');
    expect(brief.key_questions).toHaveLength(2);
    expect(brief.scope.comparators).toEqual(['A', 'B']);
    expect(brief.scope.timeframe.from).toBe(2010);
    expect(brief.deliverable).toBe('Report');
    expect(brief.success_criteria).toHaveLength(2);
    expect(loadJobVersions(jobId).length).toBeGreaterThan(1);
  });
});
