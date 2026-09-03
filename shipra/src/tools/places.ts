import { fold } from "./fold";
import { repairSpeech } from "./speech";

export type Geo = { label: string; lat: number; lon: number };

const PLACE_ALIAS: Record<string, string> = {
  gurugram: "gurgaon",
  gurgaon: "gurgaon",
  "new delhi": "delhi",
  motihari: "motihari",
  "moti hari": "motihari",
  gopalganj: "gopalganj",
  "gopal ganj": "gopalganj",
  patna: "patna",
  siwan: "siwan",
  hisar: "hisar",
  hissar: "hisar",
  "red fort": "red fort",
  "lal kila": "red fort",
  "lal qila": "red fort",
  harsaru: "harsaru",
  "gadhi harsaru": "harsaru",
  "ghadi harsaru": "harsaru",
  "gari harsaru": "harsaru",
};

const KNOWN: Record<string, Geo> = {
  delhi: { label: "Delhi", lat: 28.6139, lon: 77.209 },
  mumbai: { label: "Mumbai", lat: 19.076, lon: 72.8777 },
  gurgaon: { label: "Gurugram", lat: 28.4595, lon: 77.0266 },
  gurugram: { label: "Gurugram", lat: 28.4595, lon: 77.0266 },
  noida: { label: "Noida", lat: 28.5355, lon: 77.391 },
  faridabad: { label: "Faridabad", lat: 28.4089, lon: 77.3178 },
  ghaziabad: { label: "Ghaziabad", lat: 28.6692, lon: 77.4538 },
  hisar: { label: "Hisar", lat: 29.1492, lon: 75.7217 },
  chandigarh: { label: "Chandigarh", lat: 30.7333, lon: 76.7794 },
  jaipur: { label: "Jaipur", lat: 26.9124, lon: 75.7873 },
  lucknow: { label: "Lucknow", lat: 26.8467, lon: 80.9462 },
  kanpur: { label: "Kanpur", lat: 26.4499, lon: 80.3319 },
  varanasi: { label: "Varanasi", lat: 25.3176, lon: 82.9739 },
  patna: { label: "Patna", lat: 25.5941, lon: 85.1376 },
  gaya: { label: "Gaya", lat: 24.7914, lon: 85.0002 },
  muzaffarpur: { label: "Muzaffarpur", lat: 26.1225, lon: 85.3906 },
  motihari: { label: "Motihari", lat: 26.657, lon: 84.916 },
  bettiah: { label: "Bettiah", lat: 26.802, lon: 84.503 },
  siwan: { label: "Siwan", lat: 26.221, lon: 84.356 },
  gopalganj: { label: "Gopalganj", lat: 26.467, lon: 84.44 },
  chhapra: { label: "Chhapra", lat: 25.781, lon: 84.75 },
  hajipur: { label: "Hajipur", lat: 25.685, lon: 85.208 },
  kolkata: { label: "Kolkata", lat: 22.5726, lon: 88.3639 },
  chennai: { label: "Chennai", lat: 13.0827, lon: 80.2707 },
  bangalore: { label: "Bengaluru", lat: 12.9716, lon: 77.5946 },
  bengaluru: { label: "Bengaluru", lat: 12.9716, lon: 77.5946 },
  hyderabad: { label: "Hyderabad", lat: 17.385, lon: 78.4867 },
  pune: { label: "Pune", lat: 18.5204, lon: 73.8567 },
  ahmedabad: { label: "Ahmedabad", lat: 23.0225, lon: 72.5714 },
  "red fort": { label: "Red Fort", lat: 28.6562, lon: 77.241 },
  "red fort delhi": { label: "Red Fort", lat: 28.6562, lon: 77.241 },
  "lal kila": { label: "Red Fort", lat: 28.6562, lon: 77.241 },
  harsaru: { label: "Gadhi Harsaru", lat: 28.357, lon: 76.895 },
  "gadhi harsaru": { label: "Gadhi Harsaru", lat: 28.357, lon: 76.895 },
};

function getJson<T>(url: string): Promise<T | null> {
  return fetch(url, { signal: AbortSignal.timeout(8000) })
    .then(async (res) => (res.ok ? ((await res.json()) as T) : null))
    .catch(() => null);
}

function compact(name: string) {
  return fold(repairSpeech(name)).replace(/\s+/g, " ").trim();
}

function letters(name: string) {
  return compact(name).replace(/[^a-z0-9]/g, "");
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cur = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = cur;
    }
  }
  return row[b.length];
}

function fuzzyKnown(name: string): Geo | null {
  const key = compact(name);
  const alias = PLACE_ALIAS[key] || key;
  if (KNOWN[alias]) return KNOWN[alias];
  if (KNOWN[key]) return KNOWN[key];
  const needle = letters(alias);
  if (needle.length < 4) return null;
  let best: Geo | null = null;
  let bestDist = 99;
  for (const [place, geo] of Object.entries(KNOWN)) {
    const target = letters(place);
    const d = levenshtein(needle, target);
    const allow = needle.length <= 5 ? 1 : 2;
    if (d <= allow && d < bestDist) {
      best = geo;
      bestDist = d;
    }
  }
  return best;
}

function placeVariants(name: string) {
  const f = compact(name);
  const stripped = f
    .replace(/\b(haryana|bihar|india|uttar|pradesh|state|district)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const alias = PLACE_ALIAS[f] || PLACE_ALIAS[stripped];
  const lastTwo = stripped.split(" ").slice(-2).join(" ");
  const last = stripped.split(" ").filter(Boolean).pop() || "";
  return [...new Set([alias, f, stripped, lastTwo, last].filter((item) => item && item.length > 1))];
}

async function geocodeOpenMeteo(q: string): Promise<Geo | null> {
  const urls = [
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&countryCode=IN`,
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5`,
  ];
  for (const url of urls) {
    const data = await getJson<{
      results?: { name: string; latitude: number; longitude: number; population?: number; country_code?: string }[];
    }>(url);
    const list = data?.results || [];
    if (!list.length) continue;
    const india = list.filter((item) => item.country_code === "IN");
    const pick = (india.length ? india : list).sort(
      (x, y) => (y.population || 0) - (x.population || 0)
    )[0];
    if (pick) return { label: pick.name, lat: pick.latitude, lon: pick.longitude };
  }
  return null;
}

async function geocodeNominatim(q: string): Promise<Geo | null> {
  const data = await getJson<{ label?: string; lat?: number; lon?: number }>(
    `${import.meta.env.BASE_URL}api/geocode?q=${encodeURIComponent(q)}`
  );
  if (data?.lat && data?.lon) {
    return { label: data.label || q, lat: data.lat, lon: data.lon };
  }
  return null;
}

async function geocodePhoton(q: string): Promise<Geo | null> {
  const data = await getJson<{
    features?: {
      properties?: { name?: string; city?: string; countrycode?: string };
      geometry?: { coordinates?: number[] };
    }[];
  }>(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5`);
  const features = data?.features || [];
  const ranked = [...features].sort((a, b) => {
    const ac = (a.properties?.countrycode || "").toLowerCase() === "in" ? 1 : 0;
    const bc = (b.properties?.countrycode || "").toLowerCase() === "in" ? 1 : 0;
    return bc - ac;
  });
  const hit = ranked[0];
  const coords = hit?.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  return {
    label: hit.properties?.name || hit.properties?.city || q,
    lat: coords[1],
    lon: coords[0],
  };
}

export async function geocode(name: string): Promise<Geo | null> {
  const variants = placeVariants(name);
  for (const q of variants) {
    const known = fuzzyKnown(q);
    if (known) return known;
  }
  for (const q of variants) {
    const hit =
      (await geocodeOpenMeteo(q)) ||
      (await geocodeNominatim(q)) ||
      (await geocodePhoton(q));
    if (hit) return hit;
  }
  return null;
}
