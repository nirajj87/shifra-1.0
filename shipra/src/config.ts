function envFlag(name: keyof ImportMetaEnv, fallback = true) {
  const value = import.meta.env[name];
  if (value == null || value === "") return fallback;
  return value !== "false" && value !== "0";
}

function envNumber(name: keyof ImportMetaEnv, fallback: number) {
  const n = Number(import.meta.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const config = {
  apiKey: import.meta.env.VITE_GEMINI_API_KEY || "",
  model: import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash-lite",
  maxOutputTokens: envNumber("VITE_MAX_OUTPUT_TOKENS", 80),
  answerSentences: envNumber("VITE_ANSWER_SENTENCES", 2),
  welcome: envFlag("VITE_WELCOME", true),
  learnQA: envFlag("VITE_LEARN_QA", true),
  geminiEnabled: envFlag("VITE_GEMINI_ENABLED", true),
  webFallback: envFlag("VITE_WEB_FALLBACK", true),
};
