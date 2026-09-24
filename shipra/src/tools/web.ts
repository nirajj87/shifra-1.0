import { isCommandQuery, isSelfSkill } from "./free-tools";
import { fold } from "./fold";
import { repairSpeech } from "./speech";

function spoken(text: string) {
  const clean = String(text || "")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";
  const parts = clean.split(/(?<=[.!?।])\s+/).filter(Boolean);
  return parts.slice(0, 2).join(" ").slice(0, 320).trim();
}

function spokenName(text: string) {
  const clean = String(text || "")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const parts = clean.split(/(?<=[.!?।])\s+/).filter(Boolean);
  const named = parts.filter((part) =>
    /current holder|incumbent|currently|succeeded|is [A-Z][a-z]+ [A-Z]/i.test(part)
  );
  if (named.length) return named.slice(-1).join(" ").slice(0, 320).trim();
  return spoken(clean);
}

const STOP =
  /^(aajkal|kya|hai|hain|mein|me|ka|ki|ke|the|what|is|in|of|and|today|chal|raha|rahi|please|batao|today|latest|news|about|naam|name|hello|hey|where|when|why|how|who|a|an)$/i;

const GREET =
  /\b(hello|hi|hey|namaste|namaskar|good morning|good evening)\b/gi;

const WEAK_WORD =
  /^(hello|hi|hey|middle|where|here|there|thing|stuff|something|anything|this|that|very|just|like|from|with|your|mine|into)$/i;

const VIOLENT =
  /murder|murdered|raped|rape |torture|tortured|abduct|abducted|killed|beheaded|massacre|homicide|serial killer|हत्या|बलात्कार|मार डाला/i;

export function looksLikeKnowledge(text: string) {
  const f = fold(repairSpeech(text));
  if (/your name|tumhara naam|who are you|who made you|kisne banaya|what can you do|yourself|about you|introduce/.test(f)) {
    return false;
  }
  return /\b(what is|what are|who is|who are|kya hota|ke baare|ka naam|chief minister|janmashtami|university|migration|tell me about|kab hai|when is|birthday)\b/.test(
    f
  );
}

export function wikiTopic(question: string) {
  return fold(repairSpeech(question))
    .replace(GREET, " ")
    .replace(
      /\b(what is|what are|who is|who are|tell me about|ke baare mein|kya hota hai|kya hota|ka naam batao|naam batao|ka naam|please|batao)\b/g,
      " "
    )
    .replace(/[?.!,]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP.test(word) && !WEAK_WORD.test(word))
    .slice(0, 8)
    .join(" ")
    .trim();
}

export function isWeakWebTopic(question: string) {
  const topic = wikiTopic(question);
  if (topic.length < 4) return true;
  const words = topic.split(/\s+/).filter(Boolean);
  return !words.some((word) => word.length >= 5 && !WEAK_WORD.test(word));
}

function queryWantsCrime(query: string) {
  return VIOLENT.test(fold(repairSpeech(query)));
}

function tooViolent(title: string, extract: string, query: string) {
  if (queryWantsCrime(query)) return false;
  return VIOLENT.test(`${title} ${extract}`);
}

const MATCH_MIN = 0.5;

function escapeRe(word: string) {
  return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function queryTerms(query: string) {
  return fold(repairSpeech(query))
    .replace(GREET, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.test(w) && !WEAK_WORD.test(w));
}

function hasTerm(haystack: string, word: string) {
  return new RegExp(`(?:^|[^a-z0-9])${escapeRe(word)}(?:[^a-z0-9]|$)`, "i").test(
    haystack
  );
}

export function relevant(query: string, title: string, extract: string) {
  const q = queryTerms(query);
  if (!q.length) return false;
  const blob = fold(`${title} ${extract}`);
  let hits = 0;
  for (const word of q) {
    if (hasTerm(blob, word)) hits += 1;
  }
  return hits / q.length >= MATCH_MIN;
}

type WikiSearch = {
  query?: { search?: { title?: string }[] };
};

type WikiExtract = {
  query?: { pages?: Record<string, { title?: string; extract?: string; missing?: unknown }> };
};

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

function expandWikiQueries(topic: string) {
  const f = fold(topic);
  const extra: string[] = [];
  if (/\bchief minister\b/.test(f)) {
    const state = f.replace(/\bchief minister\b/g, " ").replace(/\s+/g, " ").trim();
    if (state) {
      extra.push(`current ${state} chief minister`);
      extra.push(`List of chief ministers of ${state}`);
    }
  }
  return [...new Set([topic, ...extra])];
}

async function wikipediaExtract(query: string, lang: string, wantsName = false) {
  const host = lang === "hi" ? "hi.wikipedia.org" : "en.wikipedia.org";
  const searchUrl =
    `https://${host}/w/api.php?action=query&list=search&srlimit=3` +
    `&srsearch=${encodeURIComponent(query)}&utf8=1&format=json&origin=*`;
  const found = await getJson<WikiSearch>(searchUrl);
  const titles = (found?.query?.search || [])
    .map((item) => String(item.title || "").trim())
    .filter(Boolean);
  for (const title of titles) {
    const extractUrl =
      `https://${host}/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1` +
      `&redirects=1&titles=${encodeURIComponent(title)}&format=json&origin=*`;
    const data = await getJson<WikiExtract>(extractUrl);
    const page = Object.values(data?.query?.pages || {})[0];
    if (!page || page.missing) continue;
    const text = (wantsName ? spokenName : spoken)(page.extract || "");
    if (text.length < 40) continue;
    if (/may refer to|disambiguation|अनुवाद \(Translation\)/i.test(text)) continue;
    if (tooViolent(page.title || title, text, query)) continue;
    if (
      wantsName &&
      /de facto head|executive branch|constitutional framework/i.test(text) &&
      !/incumbent|current holder|succeeded/i.test(text)
    ) {
      continue;
    }
    if (!relevant(query, page.title || title, text)) continue;
    return text;
  }
  return "";
}

async function fromWikipedia(query: string, lang: string, wantsName = false) {
  for (const q of expandWikiQueries(query)) {
    const first = await wikipediaExtract(q, "en", wantsName);
    if (first) return first;
    if (lang === "hi") {
      const hi = await wikipediaExtract(q, "hi", wantsName);
      if (hi) return hi;
    }
  }
  return "";
}

async function fromWebApi(query: string, question: string, wantsName = false) {
  const url = `${import.meta.env.BASE_URL}api/web-search?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return { text: "", source: "" };
  const data = (await res.json().catch(() => ({}))) as {
    text?: string;
    source?: string;
    hits?: { title?: string; text?: string }[];
  };
  const source =
    data.source === "google" ? "Google" : data.source === "web" ? "DuckDuckGo" : "";
  const hits = (data.hits && data.hits.length
    ? data.hits
    : data.text
      ? [{ title: "", text: data.text }]
      : []
  ).map((hit) => ({
    title: String(hit.title || ""),
    text: spoken(hit.text || ""),
  }));

  for (const hit of hits) {
    if (hit.text.length < 40) continue;
    if (tooViolent(hit.title, hit.text, question)) continue;
    if (!relevant(question, hit.title, hit.text) && !relevant(query, hit.title, hit.text)) {
      continue;
    }
    if (wantsName && !/[A-Z][a-z]+ [A-Z][a-z]+/.test(hit.text)) continue;
    return { text: hit.text, source: source || "Web" };
  }
  return { text: "", source: "" };
}

export async function lookupWeb(question: string, lang: string) {
  // Google (or DuckDuckGo) first, Wikipedia second. Each hit needs >= 50% term match.
  const q = String(question || "").trim();
  if (q.length < 4) return null;
  if (isCommandQuery(q) || isSelfSkill(q)) return null;
  if (isWeakWebTopic(q)) return null;

  const topic = wikiTopic(q);
  if (topic.length < 4) return null;

  const wantsName = /\b(naam|name|who)\b/.test(fold(repairSpeech(q)));

  try {
    const web = await fromWebApi(wantsName ? `current ${topic}` : topic, q, wantsName);
    if (web.text) return { text: web.text, source: web.source || "Google" };
  } catch {
    /* wiki next */
  }

  try {
    const wiki = await fromWikipedia(topic, lang, wantsName);
    if (wiki) return { text: wiki, source: "Wikipedia" };
  } catch {
    return null;
  }
  return null;
}
