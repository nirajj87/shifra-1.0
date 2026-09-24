import { config } from "./config";
import run from "./gemini";
import { inLang, isGreeting } from "./language";
import {
  findLearnedAnswer,
  findStaticAnswer,
  rememberQA,
  rememberUnknown,
} from "./offline";
import {
  reportGeminiFailure,
  reportGeminiSuccess,
  shouldTryGemini,
} from "./gemini-status";
import { fold } from "./tools/fold";
import { handleFreeTools, isDistanceQuery, looksLikeTranslateQuery, toolSourceName } from "./tools/free-tools";
import { handleSystemCommand } from "./tools/system";
import { lookupWeb, looksLikeKnowledge, isWeakWebTopic } from "./tools/web";
import { getWeatherReply, isWeatherQuestion, isWeatherSmallTalk } from "./tools/weather.js";
import { hasGroup, isToolSpeech } from "./tools/intents";
import { repairSpeech } from "./tools/speech";
import { asReply, reply } from "./reply";

const USER_NAME_KEY = "shifra_user_name";
const BAD_NAME =
  /^(kya|hai|hain|batao|bolo|bataye|please|naam|name|my|the|aapka|mera|kya hai|batao na|बताओ|क्या|है|बोलो|बता)$/i;

function isRealName(name) {
  const n = String(name || "").replace(/\s+/g, " ").trim();
  if (n.length < 2 || n.length > 40) return false;
  if (n.split(" ").length > 4) return false;
  if (BAD_NAME.test(n) || BAD_NAME.test(fold(n))) return false;
  if (/kya|batao|bolo|क्या|बताओ|बोलो/.test(n) && n.split(" ").length <= 2) return false;
  return true;
}

function userName() {
  try {
    const n = localStorage.getItem(USER_NAME_KEY) || "";
    return isRealName(n) ? n : "";
  } catch {
    return "";
  }
}

function saveUserName(name) {
  const clean = String(name || "")
    .replace(/[?.!,]/g, " ")
    .replace(/\s+(hai|hain|है|हैं)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!isRealName(clean)) return "";
  try {
    localStorage.setItem(USER_NAME_KEY, clean);
  } catch {
    /* ignore */
  }
  return clean;
}

function isAskOwnName(text) {
  const f = fold(text);
  return (
    /\b(mera|my) naam (kya|batao|bolo|bataye)\b/.test(f) ||
    /\bwhat(?:'s| is)? my name\b/.test(f) ||
    /मेरा नाम (क्या|बताओ|बोलो)/.test(text)
  );
}

function toldName(text) {
  if (isAskOwnName(text)) return null;
  const hit =
    text.match(/mera naam\s+(.+)/i) ||
    text.match(/my name is\s+(.+)/i) ||
    text.match(/मेरा नाम\s+(.+)/);
  if (!hit) return null;
  return saveUserName(hit[1]);
}

function handleUserName(text, lang) {
  if (isAskOwnName(text)) {
    const name = userName();
    if (name) {
      return inLang(lang, `Your name is ${name}.`, `Aapka naam ${name} hai.`);
    }
    return inLang(
      lang,
      "I don't know your name yet. Tell me: my name is ...",
      "Abhi aapka naam nahi pata. Bolo: mera naam Niraj hai."
    );
  }
  const name = toldName(text);
  if (name) {
    return inLang(lang, `Nice to meet you, ${name}.`, `Accha, ${name}. Yaad rakh liya!`);
  }
  return null;
}

function cleanResponse(text) {
  return String(text || "")
    .replace(/\*+/g, "")
    .replace(/_+/g, "")
    .replace(/<\/?[bi]>/g, "")
    .trim();
}

function looksLikeTime(text) {
  if (isDistanceQuery(text) || looksLikeTranslateQuery(text)) return false;
  if (hasGroup(text, "news") || hasGroup(text, "weather")) return false;
  const f = fold(text);
  if (/time in /.test(f) && !/today|date/.test(f)) return false;
  return hasGroup(text, "time");
}

function looksLikeDate(text) {
  if (isDistanceQuery(text) || looksLikeTranslateQuery(text)) return false;
  if (hasGroup(text, "news")) return false;
  return hasGroup(text, "date");
}


function simpleMath(text, lang) {
  const match = text
    .toLowerCase()
    .replace(/x/g, "*")
    .match(/(-?\d+(?:\.\d+)?)\s*(\+|plus|-|minus|\*|times|\/|divided by)\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[3]);
  const op = match[2];
  let result = null;
  if (op === "+" || op === "plus") result = a + b;
  if (op === "-" || op === "minus") result = a - b;
  if (op === "*" || op === "times") result = a * b;
  if (op === "/" || op === "divided by") result = b === 0 ? null : a / b;
  if (result == null || Number.isNaN(result)) return null;
  return inLang(lang, `That's ${result}.`, `Jawab ${result} hai.`);
}

function unknownReply(text, lang) {
  rememberUnknown(text);
  return reply(
    inLang(
      lang,
      "I'm still in training. I'll learn this soon and start answering it too.",
      "Abhi mai training par hoon. Jaldi hi seekh ke iska bhi jawab dene lagungi."
    ),
    "Shifra"
  );
}

export async function think(raw, lang) {
  const text = repairSpeech(raw);
  const named = handleUserName(text, lang);
  if (named) return reply(named, "Shifra");

  const system = await handleSystemCommand(text, lang);
  if (system) return reply(system, "Shifra");

  try {
    const extra = await handleFreeTools(text, lang);
    const packed = asReply(extra, toolSourceName(text));
    if (packed) return packed;
  } catch {
    if (isDistanceQuery(text) || looksLikeTranslateQuery(text)) {
      return reply(
        inLang(
          lang,
          "I couldn't fetch that right now. Try again in a moment.",
          "Abhi yeh check nahi ho paya. Thodi der baad try karo."
        ),
        isDistanceQuery(text) ? "OSRM · OpenStreetMap" : "Google Translate"
      );
    }
  }

  if (isDistanceQuery(text)) {
    return reply(
      inLang(
        lang,
        "I couldn't find one of those places. Say two city names clearly.",
        "Jagah nahi mili. Do shehar ke naam clearly bolo."
      ),
      "OSRM · OpenStreetMap"
    );
  }

  if (looksLikeTime(text) && looksLikeDate(text)) {
    const now = new Date();
    return reply(
      inLang(
        lang,
        `Today is ${now.toLocaleDateString()} and the time is ${now.toLocaleTimeString()}.`,
        `Aaj ${now.toLocaleDateString()} hai, aur time ${now.toLocaleTimeString()} hai.`
      ),
      "Device clock"
    );
  }
  if (looksLikeTime(text)) {
    const now = new Date().toLocaleTimeString();
    return reply(
      inLang(lang, `The current time is ${now}.`, `Abhi time ${now} hai.`),
      "Device clock"
    );
  }
  if (looksLikeDate(text)) {
    const today = new Date().toLocaleDateString();
    return reply(
      inLang(lang, `Today's date is ${today}.`, `Aaj ki tarikh ${today} hai.`),
      "Device clock"
    );
  }

  if (isWeatherSmallTalk(text)) {
    return reply(
      inLang(
        lang,
        "Yeah, the weather feels moody today.",
        "Haan, aaj mausam apne mood se chal raha hai."
      ),
      "Shifra"
    );
  }

  if (isWeatherQuestion(text)) {
    try {
      return reply(await getWeatherReply(text, lang), "Open-Meteo");
    } catch {
      return reply(
        inLang(
          lang,
          "I couldn't fetch the weather right now. Try again when you're online.",
          "Mausam abhi nahi mil paya. Online hokar try karo."
        ),
        "Open-Meteo"
      );
    }
  }

  const math = simpleMath(text, lang);
  if (math) return reply(math, "Shifra");

  if (isGreeting(text) && isWeakWebTopic(text)) {
    const hi = findStaticAnswer("hello", lang);
    if (hi) return reply(hi, "Shifra");
  }

  if (!looksLikeKnowledge(text)) {
    const local = findStaticAnswer(text, lang);
    if (local) return reply(local, "Shifra");
  }

  const learned = findLearnedAnswer(text, lang);
  if (learned) return reply(learned, "Saved answers");

  if (!navigator.onLine) {
    return unknownReply(text, lang);
  }

  const allowLookup = !isToolSpeech(text) && !isWeakWebTopic(text);

  const fromSearch = async () => {
    if (!allowLookup || !config.webFallback) return null;
    try {
      return asReply(await lookupWeb(text, lang), "Wikipedia");
    } catch {
      return null;
    }
  };

  if (looksLikeKnowledge(text)) {
    const web = await fromSearch();
    if (web) return web;
  }

  if (allowLookup && config.geminiEnabled && config.apiKey && shouldTryGemini()) {
    try {
      const apiResponse = cleanResponse(await run(text, lang));
      reportGeminiSuccess();
      if (config.learnQA && !isDistanceQuery(text) && !looksLikeTranslateQuery(text)) {
        rememberQA(text, apiResponse, lang);
      }
      return reply(apiResponse, "Gemini");
    } catch (error) {
      reportGeminiFailure(error);
    }
  }

  if (!looksLikeKnowledge(text)) {
    const web = await fromSearch();
    if (web) return web;
  }

  return unknownReply(text, lang);
}
