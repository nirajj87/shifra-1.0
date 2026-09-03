import { config } from "./config";

const MODELS = [
  config.model,
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
].filter((name, index, list) => list.indexOf(name) === index);

function instruction(lang: string) {
  const n = config.answerSentences;
  const rules =
    "Never invent distances, names, dates, or news. If unsure, say you do not know. No markdown.";
  if (lang === "hi") {
    return `You are Shifra, a friendly voice assistant created by Niraj Kumar Singh. Reply in simple Hindi only. Use at most ${n} short spoken sentences. ${rules}`;
  }
  return `You are Shifra, a friendly voice assistant created by Niraj Kumar Singh. Reply in English only. Use at most ${n} short spoken sentences. ${rules}`;
}

type GeminiPart = { text?: string };
type GeminiResponse = {
  error?: { status?: string };
  candidates?: { content?: { parts?: GeminiPart[] } }[];
};

async function ask(modelName: string, prompt: string, lang: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": config.apiKey,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: instruction(lang) }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: config.maxOutputTokens,
      },
    }),
  });

  const data = (await res.json().catch(() => ({}))) as GeminiResponse;
  if (!res.ok) {
    const status = data?.error?.status || res.status;
    throw new Error(`gemini-${status}`);
  }
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  if (!text) throw new Error("gemini-empty");
  return text;
}

async function run(prompt: string, lang = "en") {
  if (!config.geminiEnabled) throw new Error("gemini-disabled");
  if (!config.apiKey) throw new Error("missing-key");

  let lastError: unknown = null;
  for (const modelName of MODELS) {
    try {
      return await ask(modelName, prompt, lang);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("gemini-failed");
}

export default run;
