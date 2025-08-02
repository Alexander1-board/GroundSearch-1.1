import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { vi } from 'vitest';

(import.meta as any).env = { ...import.meta.env, VITE_GEMINI_API_KEY: 'test-key' };

vi.mock('@google/genai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn(),
    }),
  })),
  Type: {},
}));

expect.extend(matchers);
