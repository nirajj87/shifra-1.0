import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";
import { loadEnv } from "vite";

function cleanPath(url = "") {
  return url.split("?")[0];
}

function isSearchRoute(url = "") {
  const clean = cleanPath(url);
  return clean === "/api/web-search" || clean === "/shifra/api/web-search";
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function spoken(text: string) {
  return String(text || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?।])\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(" ")
    .slice(0, 320)
    .trim();
}

type DdgTopic = { Text?: string; Topics?: DdgTopic[] };

type DdgResponse = {
  AbstractText?: string;
  Answer?: string;
  RelatedTopics?: DdgTopic[];
};

type GoogleItem = { snippet?: string; title?: string };
type GoogleResponse = { items?: GoogleItem[] };

function firstTopic(topics: DdgTopic[] = []): string {
  for (const topic of topics) {
    if (topic.Text) return topic.Text;
    const nested = firstTopic(topic.Topics || []);
    if (nested) return nested;
  }
  return "";
}

async function duckDuckGo(query: string) {
  const url =
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}` +
    `&format=json&no_html=1&skip_disambig=1`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return "";
  const data = (await res.json()) as DdgResponse;
  return spoken(data.AbstractText || data.Answer || firstTopic(data.RelatedTopics));
}

async function googleSearch(query: string, env: Record<string, string>) {
  const key = env.VITE_GOOGLE_CSE_KEY || env.GOOGLE_CSE_KEY || "";
  const cx = env.VITE_GOOGLE_CSE_CX || env.GOOGLE_CSE_CX || "";
  if (!key || !cx) return "";
  const url =
    `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(key)}` +
    `&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}&num=3`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return "";
  const data = (await res.json()) as GoogleResponse;
  const snippets = (data.items || [])
    .map((item) => String(item.snippet || "").trim())
    .filter(Boolean);
  return spoken(snippets[0] || "");
}

function isTranslateRoute(url = "") {
  const clean = cleanPath(url);
  return clean === "/api/translate" || clean === "/shifra/api/translate";
}

function parseGtx(data: unknown) {
  if (!Array.isArray(data) || !Array.isArray(data[0])) return "";
  return data[0]
    .map((part) => (Array.isArray(part) ? String(part[0] || "") : ""))
    .join("")
    .trim();
}

async function googleTranslate(q: string, tl: string) {
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto` +
    `&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return "";
  return parseGtx(await res.json().catch(() => null));
}

async function myMemory(q: string, tl: string) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=auto|${encodeURIComponent(tl)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return "";
  const data = (await res.json()) as { responseData?: { translatedText?: string } };
  return String(data?.responseData?.translatedText || "").trim();
}

function isGeocodeRoute(url = "") {
  const clean = cleanPath(url);
  return clean === "/api/geocode" || clean === "/shifra/api/geocode";
}

async function nominatim(q: string) {
  const urls = [
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`,
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
  ];
  for (const url of urls) {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "ShifraPersonalAssistant/1.0" },
    });
    if (!res.ok) continue;
    const rows = (await res.json()) as { display_name?: string; lat?: string; lon?: string }[];
    const hit = rows[0];
    if (!hit?.lat || !hit?.lon) continue;
    return {
      label: String(hit.display_name || q).split(",")[0],
      lat: Number(hit.lat),
      lon: Number(hit.lon),
    };
  }
  return null;
}

function isNewsRoute(url = "") {
  const clean = cleanPath(url);
  return clean === "/api/news" || clean === "/shifra/api/news";
}

type Headline = { title: string; source: string };

function decodeXml(value: string) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRss(xml: string, fallback: string): Headline[] {
  return xml
    .split(/<item[\s>]/i)
    .slice(1)
    .map((block) => {
      const rawTitle = decodeXml(block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "");
      const tagged = decodeXml(block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] || "");
      const parts = rawTitle.split(/\s+[-–|]\s+/);
      const fromTitle = parts.length > 1 ? parts.pop() || "" : "";
      const title = parts.join(" - ").trim() || rawTitle;
      return {
        title,
        source: tagged || fromTitle || fallback,
      };
    })
    .filter((item) => item.title.length > 18);
}

async function fetchRss(name: string, url: string): Promise<Headline[]> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(7000),
    headers: { "User-Agent": "ShifraPersonalAssistant/1.0" },
  });
  if (!res.ok) return [];
  const xml = await res.text();
  return parseRss(xml, name).slice(0, 4);
}

const NEWS_FEEDS: Record<string, [string, string][]> = {
  india: [
    ["NDTV", "https://feeds.feedburner.com/ndtvnews-top-stories"],
    ["Indian Express", "https://indianexpress.com/feed/"],
    ["The Hindu", "https://www.thehindu.com/news/national/feeder/default.rss"],
    ["BBC Hindi", "https://feeds.bbci.co.uk/hindi/rss.xml"],
    ["Google News India", "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en"],
  ],
  world: [
    ["BBC World", "https://feeds.bbci.co.uk/news/world/rss.xml"],
    ["Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml"],
    ["Reuters", "https://www.reutersagency.com/feed/?best-topics=world&post_type=best"],
    ["Google News World", "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-IN&gl=IN&ceid=IN:en"],
  ],
  us: [
    ["BBC US", "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml"],
    ["Google News US", "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en"],
  ],
  bihar: [
    ["Indian Express", "https://indianexpress.com/section/india/feed/"],
    ["Google News Bihar", "https://news.google.com/rss/search?q=Bihar+when:1d&hl=en-IN&gl=IN&ceid=IN:en"],
  ],
  cricket: [
    ["BBC Sport", "https://feeds.bbci.co.uk/sport/cricket/rss.xml"],
    ["Google News Cricket", "https://news.google.com/rss/search?q=cricket+when:1d&hl=en-IN&gl=IN&ceid=IN:en"],
  ],
  twitter: [
    ["Google News", "https://news.google.com/rss/search?q=trending+when:1d&hl=en-IN&gl=IN&ceid=IN:en"],
    ["NDTV", "https://feeds.feedburner.com/ndtvnews-top-stories"],
  ],
};

async function twitterHeadlines(topic: string, token: string): Promise<Headline[]> {
  if (!token) return [];
  const q = topic === "twitter" ? "(India OR world) lang:en -is:retweet" : `${topic} lang:en -is:retweet`;
  const url =
    `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(q)}` +
    `&max_results=10&tweet.fields=text&expansions=author_id&user.fields=username,name`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    data?: { text?: string; author_id?: string }[];
    includes?: { users?: { id?: string; username?: string; name?: string }[] };
  };
  const users = new Map((data.includes?.users || []).map((user) => [user.id || "", user]));
  return (data.data || [])
    .map((tweet) => {
      const user = users.get(tweet.author_id || "");
      const handle = user?.username ? `@${user.username}` : "X";
      const text = String(tweet.text || "").replace(/\s+/g, " ").trim();
      return { title: text.slice(0, 180), source: `X / Twitter ${handle}` };
    })
    .filter((item) => item.title.length > 20)
    .slice(0, 3);
}

async function newsBundle(topic: string, env: Record<string, string>) {
  const key = NEWS_FEEDS[topic] ? topic : "world";
  const token = env.X_BEARER_TOKEN || env.TWITTER_BEARER_TOKEN || env.VITE_X_BEARER_TOKEN || "";
  const tweets = topic === "twitter" ? await twitterHeadlines("twitter", token) : [];
  const lists = await Promise.all(
    (NEWS_FEEDS[key] || NEWS_FEEDS.world).map(([name, url]) => fetchRss(name, url).catch(() => [] as Headline[]))
  );
  const queues = lists.map((row) => [...row]);
  const seen = new Set<string>();
  const picked: Headline[] = [...tweets];
  for (const item of picked) seen.add(item.title.slice(0, 48).toLowerCase());
  let added = true;
  while (picked.length < 3 && added) {
    added = false;
    for (const queue of queues) {
      const item = queue.shift();
      if (!item) continue;
      const sig = item.title.slice(0, 48).toLowerCase();
      if (seen.has(sig)) continue;
      seen.add(sig);
      picked.push(item);
      added = true;
      if (picked.length >= 3) break;
    }
  }
  const text = picked.map((item, i) => `${i + 1}. ${item.title}`).join(" ");
  const sources = [...new Set(picked.map((item) => item.source).filter(Boolean))];
  const source = sources.slice(0, 4).join(" · ");
  return { ok: Boolean(text), text, source, twitter: tweets.length > 0 };
}

function attach(server: ViteDevServer | PreviewServer) {
  const env = loadEnv(server.config.mode, process.cwd(), "");

  server.middlewares.use((req, res, next) => {
    const url = req.url || "";

    if (isTranslateRoute(url) && req.method === "GET") {
      const full = new URL(url, "http://127.0.0.1");
      const q = full.searchParams.get("q")?.trim() || "";
      const tl = full.searchParams.get("tl")?.trim() || "en";
      if (q.length < 2) {
        json(res, 400, { ok: false, text: "" });
        return;
      }
      googleTranslate(q.slice(0, 400), tl)
        .then(async (text) => text || myMemory(q.slice(0, 400), tl))
        .then((text) => json(res, 200, { ok: Boolean(text), text }))
        .catch(() => json(res, 200, { ok: false, text: "" }));
      return;
    }

    if (isGeocodeRoute(url) && req.method === "GET") {
      const full = new URL(url, "http://127.0.0.1");
      const q = full.searchParams.get("q")?.trim() || "";
      if (q.length < 2) {
        json(res, 400, { ok: false });
        return;
      }
      nominatim(q)
        .then((place) => json(res, 200, place || { ok: false }))
        .catch(() => json(res, 200, { ok: false }));
      return;
    }

    if (isNewsRoute(url) && req.method === "GET") {
      const full = new URL(url, "http://127.0.0.1");
      const topic = (full.searchParams.get("topic") || "world").trim().toLowerCase();
      newsBundle(topic, env)
        .then((result) => json(res, 200, result))
        .catch(() => json(res, 200, { ok: false, text: "", source: "" }));
      return;
    }

    if (!isSearchRoute(url) || req.method !== "GET") {
      next();
      return;
    }
    const full = new URL(url, "http://127.0.0.1");
    const q = full.searchParams.get("q")?.trim() || "";
    if (q.length < 4) {
      json(res, 400, { ok: false, text: "" });
      return;
    }
    googleSearch(q, env)
      .then(async (google) => {
        if (google) return { source: "google", text: google };
        const ddg = await duckDuckGo(q);
        return { source: ddg ? "web" : "", text: ddg };
      })
      .then((result) => json(res, 200, { ok: Boolean(result.text), ...result }))
      .catch(() => json(res, 200, { ok: false, text: "" }));
  });
}

export function webSearchPlugin(): Plugin {
  return {
    name: "shifra-web-search",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
