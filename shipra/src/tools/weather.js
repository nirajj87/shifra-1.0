import { geocode } from "./places";
import { fold } from "./fold";
import { hasGroup } from "./intents";
import { repairSpeech } from "./speech";

const WEATHER_STOP =
  /\b(aaj|ka|ki|ke|the|what|is|today|temperature|weather|mausam|kaisa|kya|hai|kitna|degree|celsius|temp|tapman|forecast|in|of|me|mein|batao)\b/gi;

export function isWeatherSmallTalk(text) {
  const t = `${text}`.toLowerCase();
  return (
    t.includes("beiman") ||
    t.includes("beimaan") ||
    text.includes("बेईमान") ||
    t.includes("kharab mausam") ||
    t.includes("ganda mausam") ||
    text.includes("खराब मौसम")
  );
}

export function isWeatherQuestion(text) {
  if (isWeatherSmallTalk(text) && !/temperature|टेंपरेचर|तापमान|kitna degree/i.test(text)) {
    return false;
  }
  return hasGroup(text, "weather");
}

function extractPlace(text) {
  return fold(repairSpeech(text))
    .replace(WEATHER_STOP, " ")
    .replace(/[?.!,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getWeatherReply(text, lang) {
  const placeName = extractPlace(text);
  if (!placeName) {
    return lang === "hi"
      ? "Kaunsa shehar? Jaise Delhi, Hisar, ya Tokyo."
      : "Which city? Say Delhi, Hisar, or Tokyo.";
  }

  const place = await geocode(placeName);
  if (!place) {
    return lang === "hi"
      ? `${placeName} ka location nahi mila. Shehar ka naam clearly bolo.`
      : `I couldn't find ${placeName}. Please say a city name clearly.`;
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("weather-failed");
  const data = await res.json();
  const temp = data?.current?.temperature_2m;
  if (temp == null) throw new Error("weather-failed");
  if (lang === "hi") {
    return `Aaj ${place.label} ka temperature lagbhag ${Math.round(temp)} degree Celsius hai.`;
  }
  return `It's about ${Math.round(temp)}°C in ${place.label} right now.`;
}
