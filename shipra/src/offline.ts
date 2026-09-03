import commonQa from "./data/common-qa.json";
import { isGreeting } from "./language";
import { fold } from "./tools/fold";
import { looksLikeKnowledge } from "./tools/web";
import type { FillMissingResult, MissingQuestion, QaItem } from "./types";

const STORAGE_KEY = "shifra_learned_qa";
const bank = commonQa as QaItem[];

type LearnedItem = {
  q: string;
  a: string;
  lang?: string;
  norm: string;
  t: number;
};

export function normalize(text: string) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenScore(query: string, candidate: string) {
  if (!query || !candidate) return 0;
  if (query === candidate) return 1;
  if (candidate.includes(query) || query.includes(candidate)) {
    const shorter = Math.min(query.length, candidate.length);
    const longer = Math.max(query.length, candidate.length);
    if (shorter / longer < 0.7) return 0;
    return 0.72 + (shorter / longer) * 0.2;
  }
  const qw = query.split(" ").filter((w) => w.length > 2);
  const cw = new Set(candidate.split(" ").filter((w) => w.length > 2));
  if (!qw.length) return 0;
  let hit = 0;
  for (const word of qw) {
    if (cw.has(word)) hit += 1;
  }
  return hit / qw.length;
}

export function loadLearned(): LearnedItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? (list as LearnedItem[]) : [];
  } catch {
    return [];
  }
}

function isBadMemory(answer: string) {
  const t = String(answer || "").toLowerCase();
  return (
    t.includes("gemini") ||
    t.includes("api key") ||
    t.includes(".env.local") ||
    t.includes("offline handle") ||
    t.includes("common-qa.json") ||
    t.includes("src/data")
  );
}

export async function rememberUnknown(question: string) {
  const q = String(question || "").trim();
  if (q.length < 2) return;
  try {
    await fetch(`${import.meta.env.BASE_URL}api/missing-question`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q }),
    });
  } catch {
    /* file write only works with npm run dev */
  }
}

export async function exportUnknownFile() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}api/missing-question`);
    const list = await res.json();
    const blob = new Blob([JSON.stringify(list, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "missing-questions.json";
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    /* ignore */
  }
}

export async function fillMissingFromGemini(limit = 15): Promise<FillMissingResult> {
  const res = await fetch(`${import.meta.env.BASE_URL}api/fill-missing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit }),
  });
  const data = (await res.json().catch(() => ({}))) as FillMissingResult;
  if (!res.ok) {
    return {
      ok: false,
      saved: data.saved || 0,
      failed: data.failed || 0,
      left: data.left || 0,
      error: data.error || "fill-failed",
    };
  }
  return data;
}

export async function countMissingQuestions() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}api/missing-question`);
    const list = (await res.json()) as MissingQuestion[];
    return Array.isArray(list) ? list.length : 0;
  } catch {
    return 0;
  }
}

export function rememberQA(question: string, answer: string, lang: string) {
  const norm = normalize(question);
  if (!norm || !answer || isBadMemory(answer)) return;
  const list = loadLearned().filter(
    (item) => item.norm !== norm && !isBadMemory(item.a)
  );
  list.unshift({
    q: question,
    a: answer,
    lang,
    norm,
    t: Date.now(),
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 800)));
}

export function exportLearnedFile() {
  const blob = new Blob([JSON.stringify(loadLearned(), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "shifra-learned-qa.json";
  link.click();
  URL.revokeObjectURL(url);
}

function vary(answer: string, lang?: string) {
  if (!answer) return answer;
  const extras =
    lang === "hi"
      ? ["", "Haan, ", "Dekho, "]
      : ["", "Sure — ", "Quick one: "];
  const prefix = extras[Math.floor(Math.random() * extras.length)];
  return `${prefix}${answer}`.trim();
}

function fillDynamic(answer: string, lang: string) {
  if (answer === "__TIME__") {
    const now = new Date().toLocaleTimeString();
    return lang === "hi" ? `Abhi time ${now} hai.` : `The current time is ${now}.`;
  }
  if (answer === "__DATE__") {
    const today = new Date().toLocaleDateString();
    return lang === "hi" ? `Aaj ki tarikh ${today} hai.` : `Today's date is ${today}.`;
  }
  if (answer === "__LIST__") {
    return lang === "hi"
      ? "Poochho: mera naam, umar, shaadi, mausam, time, joke, Bharat ke PM, ya kisne banaya."
      : "Ask my name, age, weather, time, a joke, India's PM, or who made me.";
  }
  return answer;
}

function keyHits(query: string, key: string) {
  const k = normalize(key);
  if (!k) return 0;
  const devanagari = /[\u0900-\u097F]/.test(k);
  if (!devanagari && k.length < 5) return 0;
  if (devanagari && k.length < 3) return 0;
  if (!devanagari) {
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|\\s)${escaped}(?:$|\\s)`, "i");
    return re.test(` ${query} `) ? k.length : 0;
  }
  return query.includes(k) ? k.length : 0;
}

export function findCommonAnswer(question: string, lang: string) {
  if (looksLikeKnowledge(question)) return null;
  const query = normalize(question);
  const folded = normalize(fold(question));
  if (!query) return null;
  let best: QaItem | null = null;
  let bestLen = 0;
  for (const item of bank) {
    for (const key of item.keys) {
      const len = Math.max(keyHits(query, key), keyHits(folded, key));
      if (len > bestLen) {
        best = item;
        bestLen = len;
      }
    }
  }
  if (!best || bestLen < 3) return null;
  if (best.id === "greeting" && !isGreeting(question)) return null;
  if (best.id === "creator" && !/you|tum|shifra|banaya|created|made you/i.test(`${query} ${folded}`)) {
    return null;
  }
  if (query.split(" ").length > 8 && bestLen / query.length < 0.28) return null;
  const raw = lang === "hi" ? best.hi : best.en;
  return fillDynamic(raw, lang);
}

export function findStaticAnswer(question: string, lang: string) {
  return findCommonAnswer(question, lang);
}

export function findLearnedAnswer(question: string, lang: string) {
  const query = normalize(question);
  const list = loadLearned();
  let best: LearnedItem | null = null;
  let bestScore = 0;
  for (const item of list) {
    if (isBadMemory(item.a)) continue;
    const score = tokenScore(query, item.norm);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  if (!best || bestScore < 0.86) return null;
  return vary(best.a, lang || best.lang);
}
