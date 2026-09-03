export type Reply = {
  text: string;
  source: string;
};

export function reply(text: string, source = ""): Reply {
  return { text: String(text || "").trim(), source: String(source || "").trim() };
}

export function asReply(value: unknown, fallbackSource = ""): Reply | null {
  if (value == null || value === false) return null;
  if (typeof value === "string") {
    const text = value.trim();
    return text ? reply(text, fallbackSource) : null;
  }
  if (typeof value === "object" && value && "text" in value) {
    const text = String((value as { text?: string }).text || "").trim();
    if (!text) return null;
    const source = String((value as { source?: string }).source || fallbackSource);
    return reply(text, source);
  }
  return null;
}
