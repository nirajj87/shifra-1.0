import { inLang } from "../language";
import { fold } from "./fold";
import { geocode, type Geo } from "./places";
import { repairSpeech } from "./speech";

const LANGS: Record<string, string> = {
  hindi: "hi",
  hi: "hi",
  हिंदी: "hi",
  हिन्दी: "hi",
  hinglish: "hi",
  english: "en",
  en: "en",
  inglish: "en",
  अंग्रेजी: "en",
  अंग्रेज़ी: "en",
  इंग्लिश: "en",
  इंगलिश: "en",
  spanish: "es",
  espanol: "es",
  french: "fr",
  german: "de",
  tamil: "ta",
  punjabi: "pa",
  bengali: "bn",
  bangla: "bn",
  marathi: "mr",
  gujarati: "gu",
  urdu: "ur",
  arabic: "ar",
  chinese: "zh",
  japanese: "ja",
  korean: "ko",
  russian: "ru",
};

const CURRENCY: Record<string, string> = {
  dollar: "usd",
  dollars: "usd",
  usd: "usd",
  rupee: "inr",
  rupees: "inr",
  inr: "inr",
  rs: "inr",
  euro: "eur",
  euros: "eur",
  eur: "eur",
  pound: "gbp",
  pounds: "gbp",
  gbp: "gbp",
  yen: "jpy",
  jpy: "jpy",
};

const TIMEZONES: Record<string, string> = {
  delhi: "Asia/Kolkata",
  mumbai: "Asia/Kolkata",
  hisar: "Asia/Kolkata",
  kolkata: "Asia/Kolkata",
  india: "Asia/Kolkata",
  london: "Europe/London",
  tokyo: "Asia/Tokyo",
  japan: "Asia/Tokyo",
  dubai: "Asia/Dubai",
  "new york": "America/New_York",
  america: "America/New_York",
  usa: "America/New_York",
  ny: "America/New_York",
  paris: "Europe/Paris",
  sydney: "Australia/Sydney",
  singapore: "Asia/Singapore",
  beijing: "Asia/Shanghai",
  moscow: "Europe/Moscow",
};

function getJson<T>(url: string): Promise<T | null> {
  return fetch(url, { signal: AbortSignal.timeout(8000) })
    .then(async (res) => (res.ok ? ((await res.json()) as T) : null))
    .catch(() => null);
}

function langCode(name: string) {
  return LANGS[name.toLowerCase().trim()] || LANGS[name.trim()] || "";
}

function looksLikeTranslate(text: string) {
  const f = fold(repairSpeech(text));
  return (
    /translate|translation/.test(f) ||
    /\b(ka|ki|ke|ko)\s+(english|hindi)\b/.test(f) ||
    /\bin\s+(english|hindi|spanish|french|german)\b/.test(f) ||
    /\b(english|hindi)\s+mein\b/.test(f)
  );
}

function parseTranslate(text: string) {
  const raw = repairSpeech(text);
  const f = fold(raw);
  if (!looksLikeTranslate(text)) return null;

  const hit =
    f.match(/^(.+?)\s+translate\s+(?:in|to|into)\s+(english|hindi|spanish|french|german)$/) ||
    f.match(/translate\s+(.+?)\s+(?:to|into|in)\s+(english|hindi|spanish|french|german)/) ||
    f.match(/^(.+?)\s+in\s+(english|hindi|spanish|french|german)$/) ||
    f.match(/^(.+?)\s+(?:ka|ki|ke|ko)\s+(english|hindi|spanish|french|german)(?:\s+mein)?(?:\s+translation)?/) ||
    f.match(/^(.+?)\s+(english|hindi)\s+mein(?:\s+translation)?/) ||
    f.match(/^(.+?)\s+(?:ka|ki)\s+(english|hindi)\s+mein\s+translation/);

  if (!hit) return null;
  const foldedQ = hit[1]
    .replace(/^(translate|translation)\s+/, "")
    .replace(/\s+(ka|ki|ke|ko|mein|batao|kya|hota|hai|karen|karo)$/g, "")
    .trim();
  const tl = langCode(hit[2]);
  if (!foldedQ || foldedQ.length < 1 || !tl) return null;
  if (/^(open|play|start|distance|weather|mausam|what|do|you|know|how|speak|tell)$/.test(foldedQ)) {
    return null;
  }
  const fromOriginal = raw
    .split(
      /ट्रांसल|translate|\s+in hindi|\s+in english|इन हिंदी|इन इंग्लिश|\s+ka english|\s+ki english|\s+का अंग्रेजी|\s+की इंग्लिश|\s+की अंग्रेजी|\s+इंग्लिश में|\s+हिंदी में|\s+हिन्दी में/i
    )[0]
    .trim()
    .replace(/\s*(का|की|के|को|ka|ki|ke|ko)$/i, "")
    .trim();
  const q =
    fromOriginal.length >= 2 &&
    !/^translate$/i.test(fromOriginal) &&
    !/hindi|english|हिंदी|इंग्लिश|translate|translation/i.test(fromOriginal)
      ? fromOriginal
      : foldedQ;
  return { q: q.replace(/\s+/g, " "), tl };
}

function hinglishSource(q: string) {
  return /[ा-ौ]|jata|jati|hai|kya|nam |mera |tum |ka |ki |se /i.test(q);
}

async function googleTranslate(q: string, tl: string) {
  const url =
    `${import.meta.env.BASE_URL}api/translate?q=${encodeURIComponent(q)}` +
    `&tl=${encodeURIComponent(tl)}`;
  const data = await getJson<{ text?: string }>(url);
  if (data?.text && !/jata|jati/i.test(data.text)) return data.text;
  const pair = hinglishSource(q) && tl === "en" ? "hi|en" : `auto|${tl}`;
  const mem = await getJson<{ responseData?: { translatedText?: string } }>(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${pair}`
  );
  return String(mem?.responseData?.translatedText || data?.text || "").trim();
}

const DIST_WORD = String.raw`(?:duri|door|dur|distance|distens|km|kilometer|kilometre)`;
const PLACE_JOIN = String.raw`(?:se|to|from|tak)`;

function parseDistance(text: string) {
  if (/\d/.test(text) && /convert|कन्वर्ट|miles?|मील|मिले/.test(fold(text))) {
    return null;
  }
  const f = fold(repairSpeech(text));
  const explicit = /\b(duri|door|dur|distance|distens|far)\b/.test(f);
  const kmPair = new RegExp(String.raw`${PLACE_JOIN} .+\bkm\b`).test(f);
  if (!explicit && !kmPair) return null;
  const hit =
    f.match(/distance between (.+?) and (.+)/) ||
    f.match(/how far (?:is )?(.+?) from (.+)/) ||
    f.match(/how far (?:is )?(.+?) to (.+)/) ||
    f.match(new RegExp(String.raw`(.+?) ${PLACE_JOIN} (.+?) (?:kitna|kitni) ${DIST_WORD}\b`)) ||
    f.match(new RegExp(String.raw`(.+?) ${PLACE_JOIN} (.+?) (?:ki|ka|ke) ${DIST_WORD}\b`)) ||
    f.match(new RegExp(String.raw`(.+?) ${PLACE_JOIN} (.+?) ${DIST_WORD}\b`)) ||
    f.match(/(.+?) (?:aur|and) (.+?) (?:ke beech|ka distance|ki duri|ki door)/) ||
    f.match(new RegExp(String.raw`^(.+?) ${PLACE_JOIN} (.+)$`));
  if (!hit) return null;
  const clean = (s: string) =>
    s
      .replace(
        new RegExp(
          String.raw`\b(the|city|of|ki|ke|ka|ko|se|to|from|tak|hai|batao|kya|kitna|kitni|sar|uttar|duri|door|dur|distance|distens|km|kilometer|kilometre)\b`,
          "g"
        ),
        " "
      )
      .replace(/\s+/g, " ")
      .trim();
  const a = clean(hit[1]);
  const b = clean(hit[2]);
  if (a.length < 2 || b.length < 2 || a === b) return null;
  return { a, b };
}

function haversine(a: Geo, b: Geo) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

async function drivingKm(a: Geo, b: Geo) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}` +
    `?overview=false`;
  const data = await getJson<{ routes?: { distance?: number }[] }>(url);
  const meters = data?.routes?.[0]?.distance;
  return meters && meters > 0 ? meters / 1000 : null;
}

function parseCurrency(text: string) {
  const t = text.toLowerCase().replace(/[?,]/g, " ");
  const hit =
    t.match(
      /(\d+(?:\.\d+)?)\s*(dollar|dollars|usd|rupee|rupees|inr|rs|euro|euros|eur|pound|pounds|gbp|yen)\s*(?:in|to|mein|me|ka)?\s*(dollar|dollars|usd|rupee|rupees|inr|rs|euro|euros|eur|pound|pounds|gbp|yen)?/
    ) || t.match(/(\d+(?:\.\d+)?)\s*(usd|inr|eur|gbp|jpy)\s+to\s+(usd|inr|eur|gbp|jpy)/);
  if (!hit) return null;
  const amount = Number(hit[1]);
  const from = CURRENCY[hit[2]];
  const toName = hit[3] || (from === "usd" ? "inr" : from === "inr" ? "usd" : "inr");
  const to = CURRENCY[toName] || "inr";
  if (!Number.isFinite(amount) || !from || from === to) return null;
  return { amount, from, to };
}

async function convertCurrency(amount: number, from: string, to: string) {
  const data = await getJson<Record<string, Record<string, number>>>(
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${from}.min.json`
  );
  const rate = data?.[from]?.[to];
  if (!rate) return null;
  return amount * rate;
}

function parseDefine(text: string) {
  if (looksLikeTranslate(text)) return null;
  const t = text.trim();
  const hit =
    t.match(/^(?:define|meaning of|what does)\s+([a-zA-Z-]+)/i) ||
    t.match(/^([a-zA-Z-]{3,})\s+(?:ka matlab|matlab kya|definition)$/i);
  if (!hit) return null;
  return hit[1].toLowerCase();
}

async function defineWord(word: string) {
  const data = await getJson<{ meanings?: { definitions?: { definition?: string }[] }[] }[]>(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
  );
  const def = data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition;
  return def ? String(def).split(/(?<=[.!?])\s+/)[0] : "";
}

function unitKind(word: string) {
  const w = word.toLowerCase();
  if (/^(miles?|मील|मिले|माईल|माইল)$/i.test(w) || w === "मील" || w === "मिले" || w === "माईल" || w === "माइल") {
    return "mi";
  }
  if (/^(km|kms|kilometers?|kilometres?|किलोमीटर|किमी)$/i.test(w) || w.includes("किलोमीटर") || w === "किमी") {
    return "km";
  }
  if (/celsius|centigrade|सेल्सियस/.test(w)) return "c";
  if (/fahrenheit|फारेनहाइट/.test(w)) return "f";
  if (/^(kg|kilo|kilogram|किलो)$/i.test(w)) return "kg";
  if (/^(pounds?|lbs?)$/i.test(w)) return "lb";
  return "";
}

function parseUnits(text: string) {
  const hit = text.match(
    /(-?\d+(?:\.\d+)?)\s*(miles?|mile|मील|मिले|माईल|माइल|km|kms|kilometers?|kilometres?|किलोमीटर|किमी|celsius|centigrade|fahrenheit|kg|kilo|kilogram|pounds?|lbs?)/i
  );
  if (!hit) return null;
  const n = Number(hit[1]);
  if (!Number.isFinite(n)) return null;
  const from = unitKind(hit[2]);
  if (!from) return null;
  const rest = text.slice((hit.index || 0) + hit[0].length);
  const toHit = rest.match(
    /(miles?|mile|मील|मिले|km|kilometers?|किलोमीटर|किमी|celsius|fahrenheit|kg|pounds?|lbs?)/i
  );
  const to = toHit ? unitKind(toHit[1]) : "";
  const converting = /convert|कन्वर्ट|बदलो|में करो|को/.test(text) || /in|to|mein/.test(rest);
  if (!to && !converting) return null;

  const dest = to || (from === "mi" ? "km" : from === "km" ? "mi" : from === "c" ? "f" : from === "f" ? "c" : from === "kg" ? "lb" : "kg");
  if (from === "mi" && dest === "km") {
    return { text: `${n} miles = ${(n * 1.60934).toFixed(1)} km.` };
  }
  if (from === "km" && dest === "mi") {
    return { text: `${n} km = ${(n * 0.621371).toFixed(1)} miles.` };
  }
  if (from === "c" && dest === "f") {
    return { text: `${n}°C = ${((n * 9) / 5 + 32).toFixed(1)}°F.` };
  }
  if (from === "f" && dest === "c") {
    return { text: `${n}°F = ${(((n - 32) * 5) / 9).toFixed(1)}°C.` };
  }
  if (from === "kg" && dest === "lb") {
    return { text: `${n} kg = ${(n * 2.20462).toFixed(1)} pounds.` };
  }
  if (from === "lb" && dest === "kg") {
    return { text: `${n} pounds = ${(n / 2.20462).toFixed(1)} kg.` };
  }
  return null;
}

function parseWorldTime(text: string) {
  const f = fold(text);
  if (/aajkal|news|chal raha/.test(f)) return null;
  const hit =
    f.match(/time in ([a-z ]{3,24})/) ||
    f.match(/([a-z ]{3,24}) ka (?:time|samay)/);
  if (!hit) return null;
  const city = hit[1].replace(/\b(the|city|current|abhi|kya|hai|today|date)\b/g, "").trim();
  if (!city) return null;
  const zone = TIMEZONES[city];
  if (!zone) return { city, zone: "" };
  return { city, zone };
}

function parseNews(text: string) {
  const f = fold(text);
  const newsish = /news|headline|aajkal|kya chal raha|latest news|twitter|tweet/.test(f);
  if (!newsish) return null;
  if (/\btwitter\b|\btweet\b/.test(f)) return { topic: "twitter" };
  if (/\bbihar\b/.test(f)) return { topic: "bihar" };
  if (/\bcricket\b/.test(f)) return { topic: "cricket" };
  if (/\bamerica\b|\busa\b/.test(f)) return { topic: "us" };
  if (/\bindia\b|\bbharat\b/.test(f)) return { topic: "india" };
  return { topic: "world" };
}

async function newsReply(topic: string, lang: string) {
  const data = await getJson<{ text?: string; source?: string; twitter?: boolean }>(
    `${import.meta.env.BASE_URL}api/news?topic=${encodeURIComponent(topic)}`
  );
  const text = String(data?.text || "").trim();
  if (text) {
    const spoken = inLang(
      lang,
      topic === "twitter" && !data?.twitter
        ? `Live Twitter feed needs an API key. Headlines: ${text}`
        : text,
      topic === "twitter" && !data?.twitter
        ? `Twitter live feed ke liye API key chahiye. Headlines: ${text}`
        : text
    );
    return { text: spoken, source: data?.source || "News RSS" };
  }
  return {
    text: inLang(
      lang,
      `I couldn't fetch ${topic} news right now.`,
      `${topic} ki news abhi nahi mil payi.`
    ),
    source: "News RSS",
  };
}

export function toolSourceName(text: string) {
  if (parseDistance(text)) return "OSRM · OpenStreetMap";
  if (looksLikeTranslate(text)) return "Google Translate";
  if (parseNews(text)) return "News RSS";
  if (parseCurrency(text)) return "Currency API";
  if (parseDefine(text)) return "Dictionary";
  if (parseUnits(text)) return "Shifra";
  if (parseWorldTime(text)) return "Device clock";
  if (looksLikeJoke(text)) return "JokeAPI";
  if (looksLikeFact(text)) return "Useless Facts";
  if (isSelfSkill(text)) return "Shifra";
  return "Shifra";
}

export function looksLikeTranslateQuery(text: string) {
  return looksLikeTranslate(text);
}

export function isDistanceQuery(text: string) {
  return Boolean(parseDistance(text));
}

export function isSelfSkill(text: string) {
  const f = fold(text);
  return /what do you know|how (?:do you )?speak|can you speak|do you speak|what can you say|kya bol sakti|kaise bol/.test(
    f
  );
}

export function isCommandQuery(text: string) {
  return Boolean(
    parseTranslate(text) ||
      parseUnits(text) ||
      parseNews(text) ||
      parseDistance(text) ||
      parseCurrency(text) ||
      looksLikeTranslate(text) ||
      isSelfSkill(text) ||
      /convert|कन्वर्ट|translation|translate/.test(fold(text))
  );
}

function looksLikeJoke(text: string) {
  const t = fold(repairSpeech(text));
  return (
    t.includes("tell me a joke") ||
    t.includes("share a joke") ||
    t.includes("joke sunao") ||
    t === "joke" ||
    t.includes("चुटकुला") ||
    t.includes("ek joke")
  );
}

function looksLikeFact(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("random fact") ||
    t.includes("tell me a fact") ||
    t.includes("ek fact") ||
    t.includes("interesting fact")
  );
}

async function randomJoke() {
  const data = await getJson<{ joke?: string }>(
    "https://v2.jokeapi.dev/joke/Any?type=single&safe-mode"
  );
  return String(data?.joke || "").trim();
}

async function randomFact() {
  const data = await getJson<{ text?: string }>(
    "https://uselessfacts.jsph.pl/api/v2/facts/random?language=en"
  );
  return String(data?.text || "").trim();
}

export async function handleFreeTools(text: string, lang: string) {
  const dist = parseDistance(text);
  if (dist) {
    const from = await geocode(dist.a);
    const to = await geocode(dist.b);
    if (!from || !to) {
      return inLang(
        lang,
        "I couldn't find one of those places. Say two city names clearly.",
        "Jagah nahi mili. Do shehar ke naam clearly bolo."
      );
    }
    const air = Math.round(haversine(from, to));
    const drive = await drivingKm(from, to);
    if (drive) {
      const km = Math.round(drive);
      return inLang(
        lang,
        `${from.label} to ${to.label} is about ${km} km by road, ${air} km in a straight line.`,
        `${from.label} se ${to.label} road se lagbhag ${km} km hai, seedha rasta ${air} km.`
      );
    }
    return inLang(
      lang,
      `${from.label} to ${to.label} is about ${air} km in a straight line.`,
      `${from.label} se ${to.label} seedha rasta lagbhag ${air} km hai.`
    );
  }

  if (isSelfSkill(text)) {
    return inLang(
      lang,
      "I speak Hindi and English. Ask weather, distance, translate, date, or type a command.",
      "Mai Hindi aur English dono bolti hoon. Mausam, doori, translate, date, ya command type karo."
    );
  }

  const unit = parseUnits(text);
  if (unit) return unit.text;

  const tr = parseTranslate(text);
  if (tr) {
    const out = await googleTranslate(tr.q, tr.tl);
    if (!out) {
      return inLang(
        lang,
        "Translation didn't come through. Try a shorter phrase.",
        "Translate nahi ho paya. Chhota sentence try karo."
      );
    }
    return inLang(lang, `That means: ${out}`, `Iska matlab: ${out}`);
  }

  const news = parseNews(text);
  if (news) return newsReply(news.topic, lang);

  const world = parseWorldTime(text);
  if (world) {
    if (!world.zone) {
      return inLang(
        lang,
        `I don't have a timezone for ${world.city}. Try Delhi, London, Tokyo, or New York.`,
        `${world.city} ka timezone list mein nahi hai. Delhi, London, Tokyo, ya New York try karo.`
      );
    }
    const clock = new Date().toLocaleTimeString(lang === "hi" ? "hi-IN" : "en-IN", {
      timeZone: world.zone,
      hour: "numeric",
      minute: "2-digit",
    });
    return inLang(
      lang,
      `It's ${clock} in ${world.city}.`,
      `${world.city} mein abhi ${clock} hai.`
    );
  }

  const money = parseCurrency(text);
  if (money) {
    const value = await convertCurrency(money.amount, money.from, money.to);
    if (value == null) {
      return inLang(lang, "I couldn't fetch that exchange rate right now.", "Exchange rate abhi nahi mila.");
    }
    const pretty = value.toFixed(value >= 20 ? 0 : 2);
    return inLang(
      lang,
      `${money.amount} ${money.from.toUpperCase()} is about ${pretty} ${money.to.toUpperCase()}.`,
      `${money.amount} ${money.from.toUpperCase()} lagbhag ${pretty} ${money.to.toUpperCase()} hai.`
    );
  }

  const word = parseDefine(text);
  if (word) {
    const def = await defineWord(word);
    if (!def) {
      return inLang(
        lang,
        `I couldn't find a dictionary meaning for ${word}.`,
        `${word} ka dictionary matlab nahi mila.`
      );
    }
    return `${word}: ${def}`;
  }

  if (looksLikeJoke(text)) {
    const joke = await randomJoke();
    if (joke) return joke;
  }

  if (looksLikeFact(text)) {
    const fact = await randomFact();
    if (fact) return fact;
  }

  return null;
}
