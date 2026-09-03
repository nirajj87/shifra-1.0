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
  /^(aajkal|kya|hai|hain|mein|me|ka|ki|ke|the|what|is|in|of|and|today|chal|raha|rahi|please|batao|today|latest|news|about|naam|name)$/i;

export function looksLikeKnowledge(text: string) {
  const f = fold(repairSpeech(text));
  if (/your name|tumhara naam|who are you|who made you|kisne banaya|what can you do/.test(f)) {
    return false;
  }
  return /\b(what is|what are|who is|who are|kya hota|ke baare|ka naam|chief minister|janmashtami|university|migration|tell me about|kab hai|when is|birthday)\b/.test(
    f
  );
}

function wikiTopic(question: string) {
  return fold(repairSpeech(question))
    .replace(
      /\b(what is|what are|who is|who are|tell me about|ke baare mein|kya hota hai|kya hota|ka naam batao|naam batao|ka naam|please|batao)\b/g,
      " "
    )
    .replace(/[?.!,]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP.test(word))
    .slice(0, 8)
    .join(" ")
    .trim();
}

function relevant(query: string, title: string, extract: string) {
  const q = fold(query)
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.test(w));
  if (!q.length) return true;
  const blob = `${title} ${extract}`.toLowerCase();
  let hits = 0;
  for (const word of q) {
    if (blob.includes(word)) hits += 1;
  }
  return hits / q.length >= 0.28;
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

async function fromWebApi(query: string) {
  const url = `${import.meta.env.BASE_URL}api/web-search?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return { text: "", source: "" };
  const data = (await res.json().catch(() => ({}))) as { text?: string; source?: string };
  const text = spoken(data.text || "");
  const source =
    data.source === "google" ? "Google" : data.source === "web" ? "DuckDuckGo" : "";
  return { text, source };
}

export async function lookupWeb(question: string, lang: string) {
  const q = String(question || "").trim();
  if (q.length < 4) return null;
  if (isCommandQuery(q) || isSelfSkill(q)) return null;

  const topic = wikiTopic(q);
  if (topic.length < 3) return null;

  const wantsName = /\b(naam|name|who)\b/.test(fold(repairSpeech(q)));

  try {
    const web = await fromWebApi(wantsName ? `current ${topic}` : topic);
    if (web.text && (!wantsName || /[A-Z][a-z]+ [A-Z][a-z]+/.test(web.text))) {
      return { text: web.text, source: web.source || "Web" };
    }
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
