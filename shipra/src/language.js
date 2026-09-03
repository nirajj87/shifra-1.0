const ENGLISH_WORDS = [
  "hello",
  "hi",
  "hey",
  "how",
  "are",
  "you",
  "what",
  "who",
  "when",
  "where",
  "why",
  "please",
  "tell",
  "time",
  "date",
  "open",
  "thanks",
  "thank",
  "good",
  "morning",
  "night",
  "doing",
];

const HINDI_WORDS = [
  "kya",
  "hai",
  "hain",
  "kaise",
  "kaisi",
  "ho",
  "hun",
  "naam",
  "tumhara",
  "aap",
  "tum",
  "mujhe",
  "samay",
  "tarikh",
  "namaste",
  "namaskar",
  "namaskaar",
  "kaun",
  "kahan",
  "kyun",
  "bolo",
  "batao",
  "dhanyavad",
  "raha",
  "rha",
  "rahe",
  "haal",
  "hal",
];

const GREETING_PHRASES = [
  "hello",
  "hi",
  "hey",
  "namaste",
  "namaskar",
  "namaskaar",
  "how are you",
  "how r you",
  "what's up",
  "whats up",
  "what are you doing",
  "kaise ho",
  "kaisi ho",
  "kya haal",
  "kya hal",
  "kya ho raha",
  "kya ho rha",
  "kya chal raha",
  "kya chal rha",
  "हाउ आर यू",
  "नमस्ते",
  "नमस्कार",
  "कैसे हो",
  "क्या हाल",
  "क्या हो रहा",
  "क्या चल रहा",
];

const HINDI_DEVANAGARI = [
  "क्या",
  "है",
  "हैं",
  "कैसे",
  "कैसी",
  "नहीं",
  "कर",
  "रही",
  "रहा",
  "हो",
  "मैं",
  "तुम",
  "आप",
  "नाम",
  "समय",
  "नमस्ते",
  "कौन",
  "कहाँ",
  "क्यों",
  "बताओ",
];

const ENGLISH_DEVANAGARI = [
  "हेलो",
  "हैलो",
  "हाय",
  "हाउ",
  "आर",
  "यू",
  "व्हाट",
  "हू",
  "व्हेन",
  "व्हायर",
  "प्लीज",
  "टाइम",
  "डेट",
  "ओपन",
  "थैंक",
  "गुड",
  "मॉर्निंग",
  "डूइंग",
];

function countMatches(text, list) {
  return list.reduce((n, word) => (text.includes(word) ? n + 1 : n), 0);
}

function countWordMatches(text, list) {
  return list.reduce((n, word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|\\s)${escaped}(?:$|\\s|[?.!,])`, "i");
    return re.test(text) ? n + 1 : n;
  }, 0);
}

export function isGreeting(text) {
  const raw = text || "";
  const padded = ` ${raw.toLowerCase()} `;
  return GREETING_PHRASES.some((phrase) => {
    const needle = phrase.toLowerCase();
    if (needle.length <= 3) {
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(?:^|\\s)${escaped}(?:$|\\s|[?.!,])`, "i").test(padded);
    }
    return padded.includes(needle) || raw.includes(phrase);
  });
}

export function detectLanguage(text) {
  const raw = (text || "").trim();
  if (!raw) return "en";

  const lower = raw.toLowerCase();
  const padded = ` ${lower} `;
  const devanagariChars = (raw.match(/[\u0900-\u097F]/g) || []).length;
  const latinChars = (raw.match(/[a-zA-Z]/g) || []).length;

  const englishDevHits = countMatches(raw, ENGLISH_DEVANAGARI);
  const hindiDevHits = countMatches(raw, HINDI_DEVANAGARI);

  let en = countWordMatches(padded, ENGLISH_WORDS) * 3 + englishDevHits * 3;
  let hi = countWordMatches(padded, HINDI_WORDS) * 3 + hindiDevHits * 3;

  hi += devanagariChars;

  if (englishDevHits >= 2) return "en";
  if (en > hi) return "en";
  if (hi > en) return "hi";
  if (devanagariChars > 0) return "hi";
  if (latinChars > 0 && countWordMatches(padded, HINDI_WORDS) > 0) return "hi";
  return "en";
}

export function sttLangFor(lang) {
  return lang === "hi" ? "hi-IN" : "en-IN";
}

export function ttsLangFor(lang) {
  return lang === "hi" ? "hi-IN" : "en-IN";
}

const FEMALE_HINT = /female|woman|heera|swara|neerja|kalpana|zira|veena|priya|disha|ananya|microsoft heera|google हिन्दी|hindi india/i;
const MALE_HINT = /male|ravi|david|mark|george|james|thomas|rishi|microsoft ravi/i;

export function pickVoice(lang) {
  const voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return null;

  const scored = voices.map((voice) => {
    const blob = `${voice.name} ${voice.lang}`.toLowerCase();
    let score = 0;
    if (lang === "hi" && /^hi/i.test(voice.lang)) score += 6;
    if (lang === "en" && /en-in/i.test(voice.lang)) score += 6;
    if (/en-in/i.test(voice.lang)) score += 2;
    if (/^hi/i.test(voice.lang)) score += 2;
    if (FEMALE_HINT.test(blob)) score += 10;
    if (MALE_HINT.test(blob) && !/female/.test(blob)) score -= 12;
    return { voice, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.voice || null;
}

export function inLang(lang, english, hindi) {
  return lang === "hi" ? hindi : english;
}
