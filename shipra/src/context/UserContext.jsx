import React, { createContext, useEffect, useRef, useState } from "react";
import { think } from "../brain";
import { config } from "../config";
import { detectLanguage, inLang, pickVoice, sttLangFor, ttsLangFor } from "../language";
import { repairSpeech } from "../tools/speech";

export const datacontext = createContext();

function UserContext({ children }) {
  const [status, setStatus] = useState("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [messages, setMessages] = useState([]);
  const [supported, setSupported] = useState(true);
  const [copied, setCopied] = useState(false);

  const holdingRef = useRef(false);
  const finalsRef = useRef("");
  const interimRef = useRef("");
  const recognitionRef = useRef(null);
  const statusRef = useRef("idle");
  const generateResponseRef = useRef(null);
  const lastLangRef = useRef("en");
  const welcomedRef = useRef(false);

  statusRef.current = status;

  function speak(text, lang = "en") {
    if (!text) {
      setStatus("idle");
      return;
    }

    const play = () => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.volume = 1;
      utterance.rate = lang === "hi" ? 1.05 : 0.98;
      utterance.pitch = 1.15;
      const voice = pickVoice(lang);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang || ttsLangFor(lang);
      } else {
        utterance.lang = ttsLangFor(lang);
      }
      utterance.onend = () => setStatus("idle");
      utterance.onerror = () => setStatus("idle");
      setStatus("speaking");
      window.speechSynthesis.speak(utterance);
    };

    if ((window.speechSynthesis.getVoices() || []).length) {
      play();
      return;
    }
    window.speechSynthesis.onvoiceschanged = play;
    play();
  }

  async function generateResponse(text) {
    const cleaned = repairSpeech(text);
    const lang = detectLanguage(cleaned);
    lastLangRef.current = lang;
    const result = await think(cleaned, lang);
    const responseText = result?.text || "";
    const source = result?.source || "";
    setMessages((prev) => [...prev, { role: "assistant", text: responseText, source }]);
    speak(responseText, lang);
  }

  generateResponseRef.current = generateResponse;

  useEffect(() => {
    if (!config.welcome || welcomedRef.current) return;
    welcomedRef.current = true;
    const lang = navigator.language?.toLowerCase().startsWith("hi")
      ? "hi"
      : "en";
    lastLangRef.current = lang;
    const hello = inLang(
      lang,
      "Hi, I'm Shifra. Hold the mic or type a command.",
      "Namaste, mai Shifra hoon. Mic dabaye rakho ya command type karo."
    );
    setMessages([{ role: "assistant", text: hello, source: "Shifra" }]);
    const timer = window.setTimeout(() => speak(hello, lang), 350);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = sttLangFor(lastLangRef.current);

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalsRef.current = `${finalsRef.current} ${piece}`.trim();
        } else {
          interim += piece;
        }
      }
      interimRef.current = interim;
      setLiveTranscript(`${finalsRef.current} ${interim}`.trim());
    };

    recognition.onend = () => {
      if (holdingRef.current) {
        try {
          recognition.start();
        } catch {
          /* already running */
        }
        return;
      }

      const text = `${finalsRef.current} ${interimRef.current}`.trim();
      finalsRef.current = "";
      interimRef.current = "";
      setLiveTranscript("");

      if (!text) {
        setStatus("idle");
        return;
      }

      lastLangRef.current = detectLanguage(text);
      setStatus("waiting");
      setMessages((prev) => [...prev, { role: "user", text }]);
      generateResponseRef.current(text);
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted" || event.error === "no-speech") {
        return;
      }
      if (event.error === "not-allowed") {
        holdingRef.current = false;
        setStatus("idle");
        setLiveTranscript("");
        return;
      }
      if (!holdingRef.current && statusRef.current === "listening") {
        setStatus("idle");
        setLiveTranscript("");
      }
    };

    recognitionRef.current = recognition;
    window.speechSynthesis.onvoiceschanged = () => {
      pickVoice(lastLangRef.current);
    };

    return () => {
      holdingRef.current = false;
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, []);

  function startHold() {
    if (!recognitionRef.current) return;
    if (statusRef.current === "waiting" || statusRef.current === "speaking") {
      return;
    }
    holdingRef.current = true;
    finalsRef.current = "";
    interimRef.current = "";
    setLiveTranscript("");
    setStatus("listening");
    recognitionRef.current.lang = sttLangFor(lastLangRef.current);
    try {
      recognitionRef.current.start();
    } catch {
      /* already started */
    }
  }

  function endHold() {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    try {
      recognitionRef.current.stop();
    } catch {
      /* already stopped */
    }
  }

  async function copyChat() {
    const text = messages
      .map((item) => {
        const line = `${item.role === "user" ? "You" : "Shifra"}: ${item.text}`;
        return item.source ? `${line}\n(${item.source})` : line;
      })
      .join("\n\n");
    await navigator.clipboard.writeText(text || "");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function sendTyped(text) {
    const q = String(text || "").trim();
    if (!q) return;
    if (statusRef.current === "waiting" || statusRef.current === "speaking") {
      return;
    }
    holdingRef.current = false;
    lastLangRef.current = detectLanguage(q);
    setStatus("waiting");
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    generateResponseRef.current(q);
  }

  const value = {
    status,
    liveTranscript,
    messages,
    supported,
    copied,
    startHold,
    endHold,
    copyChat,
    sendTyped,
  };

  return <datacontext.Provider value={value}>{children}</datacontext.Provider>;
}

export default UserContext;
