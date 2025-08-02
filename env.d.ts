/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_WOLFRAM_ALPHA_APPID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
