import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";
import { loadEnv } from "vite";
import type { MissingQuestion, QaItem } from "./src/types";

const dir = path.dirname(fileURLToPath(import.meta.url));
const missingFile = path.join(dir, "src/data/missing-questions.json");
const bankFile = path.join(dir, "src/data/common-qa.json");

const MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

function readJson<T>(file: string, fallback: T): T {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: unknown) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readMissing(): MissingQuestion[] {
  const parsed = readJson<unknown>(missingFile, []);
  return Array.isArray(parsed) ? (parsed as MissingQuestion[]) : [];
}

function writeMissing(list: MissingQuestion[]) {
  writeJson(missingFile, list);
}

function readBank(): QaItem[] {
  const parsed = readJson<unknown>(bankFile, []);
  return Array.isArray(parsed) ? (parsed as QaItem[]) : [];
}

function writeBank(list: QaItem[]) {
  writeJson(bankFile, list);
}

function cleanPath(url = "") {
  return url.split("?")[0];
}

function isMissingRoute(url = "") {
  const clean = cleanPath(url);
  return (
    clean === "/api/missing-question" ||
    clean === "/shifra/api/missing-question"
  );
}

function isFillRoute(url = "") {
  const clean = cleanPath(url);
  return clean === "/api/fill-missing" || clean === "/shifra/api/fill-missing";
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugId(question: string, keys: string[]) {
  const base = (keys[0] || question)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
  return `auto_${base || Date.now().toString(36)}`;
}

function parseQaJson(text: string): { keys: string[]; en: string; hi: string } {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("bad-json");
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
    keys?: unknown;
    en?: unknown;
    hi?: unknown;
  };
  const keys = Array.isArray(parsed.keys)
    ? parsed.keys.map((key) => String(key || "").trim()).filter(Boolean)
    : [];
  const en = String(parsed.en || "").trim();
  const hi = String(parsed.hi || "").trim();
  if (!en || !hi) throw new Error("empty-answers");
  return { keys, en: en.slice(0, 280), hi: hi.slice(0, 280) };
}

function isBadAnswer(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("gemini") ||
    t.includes("api key") ||
    t.includes("common-qa") ||
    t.includes("as an ai")
  );
}

async function askGemini(modelName: string, apiKey: string, prompt: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 280,
      },
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: { status?: string; message?: string };
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  if (!res.ok) {
    throw new Error(data?.error?.status || `http-${res.status}`);
  }
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  if (!text) throw new Error("empty");
  return text;
}

async function generateQa(
  question: string,
  apiKey: string,
  preferredModel: string
): Promise<QaItem> {
  const prompt = `You fill a spoken Q&A bank for Shifra, a friendly Indian voice assistant.
Question: ${JSON.stringify(question)}

Return ONLY JSON, no markdown:
{"keys":["4 to 8 short phrases people might say, mix Hindi and English, include the original question"],"en":"1-2 short spoken English sentences","hi":"1-2 short spoken Hindi sentences (Roman or Devanagari)"}

Keep answers accurate, warm, and short. Do not mention Gemini, APIs, files, or that you are filling a bank.`;

  const models = [preferredModel, ...MODELS].filter(
    (name, index, list) => name && list.indexOf(name) === index
  );
  let lastError: unknown = null;
  for (const modelName of models) {
    try {
      const parsed = parseQaJson(await askGemini(modelName, apiKey, prompt));
      if (isBadAnswer(parsed.en) || isBadAnswer(parsed.hi)) {
        throw new Error("bad-answer");
      }
      const keys = [...parsed.keys, question]
        .map((key) => key.trim())
        .filter(Boolean)
        .filter((key, index, list) => list.indexOf(key) === index)
        .slice(0, 12);
      return {
        id: slugId(question, keys),
        keys,
        en: parsed.en,
        hi: parsed.hi,
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("gemini-failed");
}

async function fillMissing(limit: number, env: Record<string, string>) {
  const apiKey = env.VITE_GEMINI_API_KEY || "";
  if (!apiKey) {
    return {
      ok: false,
      error: "missing-key",
      saved: 0,
      failed: 0,
      left: readMissing().length,
    };
  }

  const missing = readMissing();
  if (!missing.length) {
    return {
      ok: true,
      saved: 0,
      failed: 0,
      left: 0,
      message: "No missing questions",
      questions: [],
    };
  }

  const batch = missing.slice(0, Math.max(1, Math.min(limit, 25)));
  const leftover = missing.slice(batch.length);
  const stillMissing: MissingQuestion[] = [...leftover];
  const bank = readBank();
  const usedIds = new Set(bank.map((item) => item.id));
  const saved: string[] = [];
  const errors: { q: string; error: string }[] = [];
  const model = env.VITE_GEMINI_MODEL || MODELS[0];

  for (const item of batch) {
    const q = String(item.q || "").trim();
    if (q.length < 2) continue;
    try {
      const qa = await generateQa(q, apiKey, model);
      let id = qa.id;
      if (usedIds.has(id)) id = `${id}_${Date.now().toString(36)}`;
      usedIds.add(id);
      bank.push({ ...qa, id });
      saved.push(q);
    } catch (error) {
      stillMissing.push(item);
      errors.push({
        q,
        error: error instanceof Error ? error.message : "failed",
      });
    }
    await sleep(700);
  }

  writeBank(bank);
  writeMissing(stillMissing);
  return {
    ok: true,
    saved: saved.length,
    failed: errors.length,
    left: stillMissing.length,
    questions: saved,
    errors,
  };
}

function attach(server: ViteDevServer | PreviewServer) {
  const env = loadEnv(server.config.mode, process.cwd(), "");

  server.middlewares.use((req, res, next) => {
    const url = req.url || "";

    if (isFillRoute(url)) {
      if (req.method !== "POST") {
        json(res, 405, { ok: false });
        return;
      }
      readBody(req)
        .then(async (raw) => {
          const body = JSON.parse(raw || "{}") as { limit?: unknown };
          const limit = Number(body.limit);
          return fillMissing(
            Number.isFinite(limit) && limit > 0 ? limit : 15,
            env
          );
        })
        .then((result) => json(res, result.ok ? 200 : 400, result))
        .catch(() => json(res, 400, { ok: false, saved: 0, failed: 0, left: 0 }));
      return;
    }

    if (!isMissingRoute(url)) {
      next();
      return;
    }

    if (req.method === "GET") {
      json(res, 200, readMissing());
      return;
    }

    if (req.method !== "POST") {
      json(res, 405, { ok: false });
      return;
    }

    readBody(req)
      .then((raw) => {
        const body = JSON.parse(raw || "{}") as { q?: unknown };
        const q = String(body.q || "").trim();
        if (q.length < 2) {
          json(res, 400, { ok: false });
          return;
        }
        const norm = q.toLowerCase().replace(/\s+/g, " ");
        const list = readMissing().filter(
          (item) =>
            String(item.q || "")
              .toLowerCase()
              .replace(/\s+/g, " ") !== norm
        );
        list.unshift({
          q,
          t: Date.now(),
          date: new Date().toISOString(),
        });
        writeMissing(list.slice(0, 500));
        json(res, 200, { ok: true });
      })
      .catch(() => json(res, 400, { ok: false }));
  });
}

export function missingQuestionsPlugin(): Plugin {
  return {
    name: "shifra-missing-questions",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
