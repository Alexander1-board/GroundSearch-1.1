import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PrePromptPanel from '../components/PrePromptPanel';

describe('Pre-prompt persistence and injection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves, reloads, and injects pre-prompt into Gemini payload', async () => {
    const jobId = 'job1';
    const { unmount } = render(<PrePromptPanel jobId={jobId} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Test preprompt' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(localStorage.getItem(`preprompt_${jobId}`)).toBe('Test preprompt');

    unmount();
    render(<PrePromptPanel jobId={jobId} />);
    expect(screen.getByRole('textbox')).toHaveValue('Test preprompt');
    (import.meta as any).env = { ...import.meta.env, VITE_GEMINI_API_KEY: 'test-key' };
    const GeminiService = await import('../services/geminiService');
    GeminiService.setPrePromptFromLocalStorage(jobId);
    const generateContent = vi.fn().mockResolvedValue({ text: '' });
    vi.spyOn(GeminiService.ai, 'getGenerativeModel').mockReturnValue({ generateContent } as any);

    await GeminiService.callModelAPI('model', [], false);
    const config = generateContent.mock.calls[0][0].config;
    expect(config.systemInstruction).toContain('Test preprompt');
    console.log(GeminiService.getLastPrompt());
  });
});
