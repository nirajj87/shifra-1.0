import { config } from "./config";
import run from "./gemini";
import { inLang } from "./language";
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
import { lookupWeb, looksLikeKnowledge } from "./tools/web";
import { getWeatherReply, isWeatherQuestion, isWeatherSmallTalk } from "./tools/weather.js";
import { repairSpeech } from "./tools/speech";
import { asReply, reply } from "./reply";

const USER_NAME_KEY = "shifra_user_name";

function userName() {
  try {
    return localStorage.getItem(USER_NAME_KEY) || "";
  } catch {
    return "";
  }
}

function saveUserName(name) {
  const clean = String(name || "")
    .replace(/\bhai\b/gi, "")
    .replace(/[?.!]/g, "")
    .trim();
  if (clean) localStorage.setItem(USER_NAME_KEY, clean);
  return clean;
}

function handleUserName(text, lang) {
  const q = text.toLowerCase();
  const told =
    text.match(/mera naam\s+(.+)/i) ||
    text.match(/my name is\s+(.+)/i) ||
    text.match(/मेरा नाम\s+(.+)/);
  if (told && !/kya|क्या/.test(told[1])) {
    const name = saveUserName(told[1]);
    if (name) {
      return inLang(lang, `Nice to meet you, ${name}.`, `Accha, ${name}. Yaad rakh liya!`);
    }
  }
  if (
    q.includes("my name") ||
    q.includes("mera naam kya") ||
    text.includes("मेरा नाम क्या") ||
    text.includes("मेरा नाम क्या है")
  ) {
    const name = userName();
    if (name) {
      return inLang(lang, `Your name is ${name}.`, `Aapka naam ${name} hai.`);
    }
    return inLang(
      lang,
      "I don't know your name yet. Tell me: my name is ...",
      "Abhi aapka naam nahi pata. Bolo: mera naam ... hai."
    );
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
  const f = fold(text);
  if (/time in /.test(f) && !/today|date/.test(f)) return false;
  return (
    f.includes("what is the time") ||
    f.includes("tell me the time") ||
    f.includes("current time") ||
    /\bsamay\b/.test(f) ||
    /\btime\b/.test(f)
  );
}

function looksLikeDate(text) {
  if (isDistanceQuery(text)) return false;
  const f = fold(text);
  return (
    f.includes("today's date") ||
    f.includes("today date") ||
    f.includes("what is the date") ||
    /\btarikh\b/.test(f) ||
    /\bdate\b/.test(f)
  );
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

  if (!looksLikeKnowledge(text)) {
    const local = findStaticAnswer(text, lang);
    if (local) return reply(local, "Shifra");
  }

  const learned = findLearnedAnswer(text, lang);
  if (learned) return reply(learned, "Saved answers");

  if (!navigator.onLine) {
    return unknownReply(text, lang);
  }

  if (config.geminiEnabled && config.apiKey && shouldTryGemini()) {
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

  if (config.webFallback) {
    try {
      const web = await lookupWeb(text, lang);
      const packed = asReply(web, "Wikipedia");
      if (packed) return packed;
    } catch {
      /* training reply below */
    }
  }

  return unknownReply(text, lang);
}
