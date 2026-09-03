import { config } from "./config";
import run from "./gemini";
import { inLang } from "./language";
import {
  findLearnedAnswer,
  findStaticAnswer,
  rememberQA,
  rememberUnknown,
} from "./offline";
import { handleSystemCommand } from "./tools/system";
import { getWeatherReply, isWeatherQuestion, isWeatherSmallTalk } from "./tools/weather.js";

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
  const t = text.toLowerCase();
  return (
    t.includes("what is the time") ||
    t.includes("tell me the time") ||
    t.includes("current time") ||
    t.includes("samay") ||
    text.includes("समय")
  );
}

function looksLikeDate(text) {
  const t = text.toLowerCase();
  return (
    t.includes("today's date") ||
    t.includes("what is the date") ||
    t.includes("tarikh") ||
    text.includes("तारीख")
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
  return inLang(
    lang,
    "I'm still in training. I'll learn this soon and start answering it too.",
    "Abhi mai training par hoon. Jaldi hi seekh ke iska bhi jawab dene lagungi."
  );
}

export async function think(text, lang) {
  if (looksLikeTime(text)) {
    const now = new Date().toLocaleTimeString();
    return inLang(lang, `The current time is ${now}.`, `Abhi time ${now} hai.`);
  }
  if (looksLikeDate(text)) {
    const today = new Date().toLocaleDateString();
    return inLang(lang, `Today's date is ${today}.`, `Aaj ki tarikh ${today} hai.`);
  }

  const named = handleUserName(text, lang);
  if (named) return named;

  const system = await handleSystemCommand(text, lang);
  if (system) return system;

  if (isWeatherSmallTalk(text)) {
    return inLang(
      lang,
      "Yeah, the weather feels moody today.",
      "Haan, aaj mausam apne mood se chal raha hai."
    );
  }

  if (isWeatherQuestion(text)) {
    try {
      return await getWeatherReply(text, lang);
    } catch {
      return inLang(
        lang,
        "I couldn't fetch the weather right now. Try again when you're online.",
        "Mausam abhi nahi mil paya. Online hokar try karo."
      );
    }
  }

  const math = simpleMath(text, lang);
  if (math) return math;

  const local = findStaticAnswer(text, lang);
  if (local) return local;

  const learned = findLearnedAnswer(text, lang);
  if (learned) return learned;

  if (!navigator.onLine || !config.geminiEnabled) {
    return unknownReply(text, lang);
  }

  try {
    const apiResponse = cleanResponse(await run(text, lang));
    if (config.learnQA) rememberQA(text, apiResponse, lang);
    return apiResponse;
  } catch {
    return unknownReply(text, lang);
  }
}
