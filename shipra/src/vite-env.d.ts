/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_GEMINI_MODEL?: string;
  readonly VITE_MAX_OUTPUT_TOKENS?: string;
  readonly VITE_ANSWER_SENTENCES?: string;
  readonly VITE_WELCOME?: string;
  readonly VITE_LEARN_QA?: string;
  readonly VITE_GEMINI_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.png" {
  const src: string;
  export default src;
}
