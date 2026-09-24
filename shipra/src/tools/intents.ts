import { fold } from "./fold";
import { repairSpeech } from "./speech";

/** Add words here. First matching group wins and that API/tool runs — not Gemini. */
export const GROUPS = {
  distance: [
    "distance",
    "distens",
    "duri",
    "doori",
    "door",
    "dur",
    "far from",
    "how far",
    "kitna far",
    "kitna door",
    "kitni door",
    "kitna dur",
    "kitni dur",
    "kitna duri",
    "kitni duri",
    "kitna doori",
    "kitni doori",
  ],
  time: [
    "time",
    "samay",
    "baje",
    "baj",
    "clock",
    "kitne baje",
    "kya time",
    "abhi time",
    "current time",
    "what time",
  ],
  date: ["date", "tarikh", "aaj ki date", "today date", "today's date", "what date"],
  weather: [
    "weather",
    "mausam",
    "temperature",
    "tapman",
    "temp",
    "celsius",
    "forecast",
    "kitna degree",
  ],
  news: [
    "news",
    "headline",
    "headlines",
    "aajkal",
    "khabar",
    "khabren",
    "samachar",
    "twitter",
    "tweet",
    "latest news",
  ],
  translate: [
    "translate",
    "translation",
    "anuvad",
    "english mein",
    "hindi mein",
    "in english",
    "in hindi",
  ],
} as const;

export type ToolGroup = keyof typeof GROUPS;

const ORDER: ToolGroup[] = ["distance", "translate", "news", "weather", "time", "date"];

function spoken(text: string) {
  return ` ${fold(repairSpeech(text))} `;
}

function escapeRe(word: string) {
  return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function hasGroup(text: string, group: ToolGroup) {
  const hay = spoken(text);
  return GROUPS[group].some((item) => {
    const needle = item.toLowerCase().trim();
    if (!needle) return false;
    if (needle.includes(" ")) return hay.includes(` ${needle} `);
    return new RegExp(`(?:^|\\s)${escapeRe(needle)}(?:$|\\s)`).test(hay);
  });
}

export function detectToolGroup(text: string): ToolGroup | null {
  return ORDER.find((group) => hasGroup(text, group)) || null;
}

export function isToolSpeech(text: string) {
  return detectToolGroup(text) != null;
}
