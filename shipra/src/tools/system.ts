import { inLang } from "../language";

type SystemIntent =
  | { action: "notepad" }
  | { action: "docker" }
  | { action: "run-project"; name?: string }
  | { action: "open-project"; name: string }
  | { action: "open-drive"; letter: string }
  | { action: "email" }
  | { action: "music"; query: string }
  | { action: "site"; url: string; label: string }
  | { action: "need-project" };

const SITES: [string[], string, string][] = [
  [["youtube"], "https://www.youtube.com", "YouTube"],
  [["facebook"], "https://www.facebook.com", "Facebook"],
  [["instagram"], "https://www.instagram.com", "Instagram"],
  [["whatsapp"], "https://web.whatsapp.com", "WhatsApp"],
  [["google"], "https://www.google.com", "Google"],
  [["gmail"], "https://mail.google.com", "Gmail"],
  [["chrome"], "https://www.google.com", "Chrome"],
];

function norm(text: string) {
  return String(text || "")
    .toLowerCase()
    .replace(/[?.!,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wantOpen(t: string) {
  return (
    t.includes("open") ||
    t.includes("kholo") ||
    t.includes("khol") ||
    t.includes("chalu") ||
    t.includes("start") ||
    t.includes("launch") ||
    t.includes("खोलो") ||
    t.includes("चलाओ")
  );
}

export function parseSystemIntent(text: string): SystemIntent | null {
  const t = norm(text);
  if (!t) return null;

  const play =
    t.match(/^(?:play|chalao|gaana chalao|gana chalao)\s+(.+)$/) ||
    t.match(/youtube(?: pe| par)?\s+(.+?)\s*(?:chalao|play|kholo)$/) ||
    t.match(/(.+?)\s+(?:gaana|gana|song|music)\s*(?:chalao|play)$/);

  if (
    t === "play music" ||
    t === "play song" ||
    t === "gaana chalao" ||
    t === "gana chalao" ||
    t === "music chalao" ||
    t.includes("गाना चलाओ") ||
    t.includes("संगीत")
  ) {
    return { action: "music", query: "music" };
  }
  if (play && !t.includes("open youtube")) {
    const query = play[1].replace(/^(music|song|gaana|gana)\s+/, "").trim();
    if (query) return { action: "music", query };
  }

  if (
    t.includes("notepad") ||
    t.includes("note pad") ||
    t.includes("नोटपैड") ||
    t.includes("नोट पैड")
  ) {
    return { action: "notepad" };
  }

  if (t.includes("docker") || t.includes("डॉकर")) {
    return { action: "docker" };
  }

  if (
    t.includes("email") ||
    t.includes("e mail") ||
    t.includes("outlook") ||
    t.includes("ईमेल") ||
    t.includes("मेल खोल")
  ) {
    return { action: "email" };
  }

  const drive =
    t.match(/(?:open\s+)?([a-z])\s*drive/) ||
    t.match(/([a-z])\s*drive\s*(?:kholo|khol|open)/) ||
    t.match(/drive\s+([a-z])/);
  if (drive) {
    return { action: "open-drive", letter: drive[1].toUpperCase() };
  }
  if (t === "open drive" || t === "drive kholo" || t.includes("ड्राइव खोल")) {
    return { action: "open-drive", letter: "D" };
  }

  const named =
    t.match(/open(?: my)? project(?: named)?\s+([a-z0-9._-]+)/) ||
    t.match(/mera project\s+([a-z0-9._-]+)/) ||
    t.match(/project\s+([a-z0-9._-]+)\s*(?:kholo|khol|open)/) ||
    t.match(/([a-z0-9._-]+)\s+project\s*(?:kholo|khol)/);
  if (named) {
    return { action: "open-project", name: named[1] };
  }
  if (
    t === "open my project" ||
    t === "open project" ||
    t === "mera project kholo" ||
    t === "project kholo"
  ) {
    return { action: "need-project" };
  }

  const run =
    t.match(/run(?: my)? project(?:\s+([a-z0-9._-]+))?/) ||
    t.match(/project(?:\s+([a-z0-9._-]+))?\s*(?:chalao|chalu karo|start)/) ||
    t.match(/npm run(?:\s+dev)?/);
  if (t.includes("run project") || t.includes("project chalao") || t === "npm run dev" || run) {
    const name = run?.[1] || (t.match(/project\s+([a-z0-9._-]+)/)?.[1]);
    return { action: "run-project", name: name || "shifra" };
  }

  if (wantOpen(t) || t.startsWith("open ")) {
    for (const [keys, url, label] of SITES) {
      if (keys.some((key) => t.includes(key))) {
        return { action: "site", url, label };
      }
    }
  }

  return null;
}

async function runLocal(body: Record<string, string>) {
  const res = await fetch(`${import.meta.env.BASE_URL}api/system`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    open?: string;
  };
  return data;
}

function localFail(lang: string) {
  return inLang(
    lang,
    "This computer command works when Shifra is running locally with npm run dev.",
    "Yeh computer command tab chalti hai jab Shifra local pe npm run dev se khuli ho."
  );
}

export async function handleSystemCommand(text: string, lang: string) {
  const intent = parseSystemIntent(text);
  if (!intent) return null;

  if (intent.action === "need-project") {
    return inLang(
      lang,
      "Which project? Say: open project shifra.",
      "Kaunsa project? Bolo: open project shifra."
    );
  }

  if (intent.action === "site") {
    window.open(intent.url, "_blank");
    return inLang(lang, `Opening ${intent.label}.`, `${intent.label} khol rahi hoon.`);
  }

  if (intent.action === "music") {
    const q = encodeURIComponent(intent.query || "music");
    window.open(`https://music.youtube.com/search?q=${q}`, "_blank");
    return inLang(
      lang,
      intent.query === "music" ? "Playing music on YouTube." : `Playing ${intent.query} on YouTube.`,
      intent.query === "music"
        ? "YouTube pe music chala rahi hoon."
        : `YouTube pe ${intent.query} chala rahi hoon.`
    );
  }

  if (intent.action === "email") {
    const result = await runLocal({ action: "email" }).catch(() => null);
    window.open(result?.open || "https://mail.google.com", "_blank");
    return inLang(lang, "Opening your email.", "Email khol rahi hoon.");
  }

  if (intent.action === "notepad") {
    const result = await runLocal({ action: "notepad" }).catch(() => null);
    if (result?.ok) {
      return inLang(lang, "Opening Notepad.", "Notepad khol rahi hoon.");
    }
    return localFail(lang);
  }

  if (intent.action === "docker") {
    const result = await runLocal({ action: "docker" }).catch(() => null);
    if (result?.ok) {
      return inLang(lang, "Starting Docker.", "Docker start kar rahi hoon.");
    }
    if (result?.error === "docker-missing") {
      return inLang(
        lang,
        "Docker Desktop was not found on this PC.",
        "Is PC pe Docker Desktop nahi mila."
      );
    }
    return localFail(lang);
  }

  if (intent.action === "open-drive") {
    const result = await runLocal({
      action: "open-drive",
      letter: intent.letter,
    }).catch(() => null);
    if (result?.ok) {
      return inLang(
        lang,
        `Opening ${intent.letter} drive.`,
        `${intent.letter} drive khol rahi hoon.`
      );
    }
    return localFail(lang);
  }

  if (intent.action === "open-project") {
    const result = await runLocal({
      action: "open-project",
      name: intent.name,
    }).catch(() => null);
    if (result?.ok) {
      return inLang(
        lang,
        `Opening project ${intent.name}.`,
        `Project ${intent.name} khol rahi hoon.`
      );
    }
    if (result?.error === "missing-folder") {
      return inLang(
        lang,
        `I couldn't find a project named ${intent.name}.`,
        `${intent.name} naam ka project nahi mila.`
      );
    }
    return localFail(lang);
  }

  if (intent.action === "run-project") {
    const name = intent.name || "shifra";
    const result = await runLocal({
      action: "run-project",
      name,
    }).catch(() => null);
    if (result?.ok) {
      return inLang(
        lang,
        `Starting project ${name}.`,
        `Project ${name} start kar rahi hoon.`
      );
    }
    if (result?.error === "missing-project") {
      return inLang(
        lang,
        `I couldn't find a runnable project named ${name}.`,
        `${name} naam ka project run nahi ho paya.`
      );
    }
    return localFail(lang);
  }

  return null;
}
