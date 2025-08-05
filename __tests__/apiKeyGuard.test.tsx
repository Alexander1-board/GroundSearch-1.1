import { render, screen } from '@testing-library/react';
import App from '../App';
import { REASONING_MODELS, TOOL_MODELS, createNewJob } from '../constants';
import { AppConfig } from '../types';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Helper to create a ready job in localStorage
function seedJob() {
  const config: AppConfig = {
    reasoningModel: REASONING_MODELS[0],
    toolModel: TOOL_MODELS[0],
    allowToolPlanFallback: true,
    isWolframEnabled: false,
    wolframAppId: '',
  };
  const job = createNewJob(config);
  job.brief = {
    objective: 'obj',
    key_questions: ['q1'],
    scope: { timeframe: { from: 2020, to: 2024 }, domains: [], comparators: [] },
    deliverable: '',
    success_criteria: [],
  };
  localStorage.setItem('groundsearch_jobs', JSON.stringify([job]));
  localStorage.setItem('groundsearch_activeJobId', JSON.stringify(job.id));
}

describe('API key guard', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
    seedJob();
    (window.HTMLElement.prototype as any).scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('shows banner and disables actions when API key missing', async () => {
    render(<App />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    const button = await screen.findByRole('button', { name: /generate plan/i });
    expect(button).toBeDisabled();
  });
});
