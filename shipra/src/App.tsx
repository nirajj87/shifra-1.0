import { useContext, useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";
import "./App.css";
import va from "./assets/ai.png";
import { CiMicrophoneOn } from "react-icons/ci";
import { datacontext } from "./context/UserContext";
import {
  countMissingQuestions,
  exportLearnedFile,
  exportUnknownFile,
  fillMissingFromGemini,
} from "./offline";
import type { AppStatus, ShifraContext } from "./types";

const BUTTON_LABEL: Record<AppStatus, string> = {
  idle: "Hold to talk",
  listening: "Release to send",
  waiting: "Thinking…",
  speaking: "Speaking…",
};

function App() {
  const {
    status,
    liveTranscript,
    messages,
    supported,
    copied,
    startHold,
    endHold,
    copyChat,
    sendTyped,
  } = useContext(datacontext) as ShifraContext;
  const chatRef = useRef<HTMLElement | null>(null);
  const busy = status === "waiting" || status === "speaking";
  const [filling, setFilling] = useState(false);
  const [fillNote, setFillNote] = useState("");
  const [missingCount, setMissingCount] = useState(0);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, liveTranscript, status]);

  useEffect(() => {
    countMissingQuestions().then(setMissingCount);
  }, [messages, fillNote]);

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (busy || !supported) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    startHold();
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    endHold();
  }

  function onTypeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = typed.trim();
    if (!q || busy) return;
    setTyped("");
    sendTyped(q);
  }

  async function onFillMissing() {
    if (filling) return;
    setFilling(true);
    setFillNote("Gemini se answers aa rahe hain…");
    try {
      const result = await fillMissingFromGemini(15);
      if (!result.ok && result.error === "missing-key") {
        setFillNote("Gemini key nahi mili. .env.local check karo.");
        return;
      }
      if (!result.ok) {
        setFillNote("Fill fail hua. Sirf npm run dev pe kaam karta hai.");
        return;
      }
      if (!result.saved && !result.left) {
        setFillNote("Missing list khali hai.");
        return;
      }
      setFillNote(
        `Saved ${result.saved} in question bank. Left ${result.left}${
          result.failed ? `, failed ${result.failed}` : ""
        }.`
      );
    } catch {
      setFillNote("Fill fail hua. Sirf npm run dev pe kaam karta hai.");
    } finally {
      setFilling(false);
      countMissingQuestions().then(setMissingCount);
    }
  }

  return (
    <div className="shell">
      <div className="glow glow-cyan" />
      <div className="glow glow-pink" />

      <header className="hero">
        <div className={`avatar-wrap ${status}`}>
          <img src={va} alt="Shifra" className="avatar" />
        </div>
        <h1>
          I'm <span>Shifra</span>
        </h1>
        <p className="subtitle">Your advanced voice assistant</p>
      </header>

      <div className="toolbar">
        <button type="button" className="tool-btn" onClick={copyChat}>
          {copied ? "Copied" : "Copy chat"}
        </button>
        <button type="button" className="tool-btn" onClick={exportLearnedFile}>
          Save answers
        </button>
        <button type="button" className="tool-btn" onClick={exportUnknownFile}>
          New questions
        </button>
        <button
          type="button"
          className="tool-btn gemini"
          onClick={onFillMissing}
          disabled={filling}
        >
          {filling ? "Filling…" : "Fill with Gemini"}
        </button>
        <span className="tool-meta">
          {missingCount ? `${missingCount} missing` : "Offline first"}
        </span>
      </div>
      {fillNote ? <p className="tool-status">{fillNote}</p> : null}

      <section className="chat" ref={chatRef}>
        {messages.map((message, index) => (
          <div key={index} className={`bubble ${message.role}`}>
            <span className="who">
              {message.role === "user" ? "You" : "Shifra"}
            </span>
            <p>{message.text}</p>
            {message.role === "assistant" && message.source ? (
              <small className="source">{message.source}</small>
            ) : null}
          </div>
        ))}
        {status === "listening" && (
          <div className="bubble user live">
            <span className="who">You</span>
            <p>{liveTranscript || "Listening…"}</p>
          </div>
        )}
        {status === "waiting" && (
          <div className="bubble assistant live">
            <span className="who">Shifra</span>
            <p className="thinking">
              <i />
              <i />
              <i />
            </p>
          </div>
        )}
      </section>

      <footer className="dock">
        <form className="type-row" onSubmit={onTypeSubmit}>
          <input
            type="text"
            value={typed}
            disabled={busy}
            placeholder="Type… translate hello to hindi, Delhi se Mumbai kitna door"
            onChange={(event) => setTyped(event.target.value)}
          />
          <button type="submit" disabled={busy || !typed.trim()}>
            Send
          </button>
        </form>
        {supported ? (
          <button
            type="button"
            className={`hold-btn ${status}`}
            disabled={busy}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onContextMenu={(event) => event.preventDefault()}
          >
            <span className="mic-icon">
              <CiMicrophoneOn />
            </span>
            {BUTTON_LABEL[status]}
          </button>
        ) : (
          <p className="hint">Mic nahi mila. Upar type karke command bhejo.</p>
        )}
      </footer>
    </div>
  );
}

export default App;
