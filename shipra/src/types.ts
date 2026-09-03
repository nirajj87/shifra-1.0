export type AppStatus = "idle" | "listening" | "waiting" | "speaking";

export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export type ShifraContext = {
  status: AppStatus;
  liveTranscript: string;
  messages: ChatMessage[];
  supported: boolean;
  copied: boolean;
  startHold: () => void;
  endHold: () => void;
  copyChat: () => void;
  sendTyped: (text: string) => void;
};

export type QaItem = {
  id: string;
  keys: string[];
  en: string;
  hi: string;
};

export type MissingQuestion = {
  q: string;
  t?: number;
  date?: string;
};

export type FillMissingResult = {
  ok: boolean;
  saved: number;
  failed: number;
  left: number;
  questions?: string[];
  errors?: { q: string; error: string }[];
  error?: string;
  message?: string;
};
