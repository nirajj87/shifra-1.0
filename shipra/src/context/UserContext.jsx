import React, { createContext, useState } from "react";
import run from "../gemini"; // Gemini AI API

export const datacontext = createContext();

function UserContext({ children }) {
  let [speaking, setSpeaking] = useState(false);
  let [prompt, setPrompt] = useState("Listening...");
  let [response, setResponse] = useState(false);

  function speak(text) {
    if (!text) return;
    window.speechSynthesis.cancel();
    let utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = 1;
    utterance.rate = 1.2;
    utterance.pitch = 1;
    utterance.lang = "hi-GB";

    utterance.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  function detectMood(text) {
    let lowerText = text.toLowerCase();
    if (
      lowerText.includes("happy") ||
      lowerText.includes("great") ||
      lowerText.includes("awesome")
    ) {
      return "happy";
    } else if (
      lowerText.includes("sad") ||
      lowerText.includes("depressed") ||
      lowerText.includes("not good")
    ) {
      return "sad";
    } else if (
      lowerText.includes("angry") ||
      lowerText.includes("mad") ||
      lowerText.includes("frustrated")
    ) {
      return "angry";
    } else if (
      lowerText.includes("excited") ||
      lowerText.includes("thrilled")
    ) {
      return "excited";
    }
    return "neutral";
  }
  function cleanResponse(response) {
    return response
      .replace(/\*+/g, "")  // Remove * and ** (Bold Markdown)
      .replace(/_+/g, "")   // Remove _ (Italic Markdown)
      .replace(/<\/?b>/g, "") // Remove <b> and </b> (Bold HTML)
      .replace(/<\/?i>/g, ""); // Remove <i> and </i> (Italic HTML)
  }

  async function generateResponse(text) {
    let lowerPrompt = text.toLowerCase();
    let responseText = null;

    // ✅ Rule 1: Time and Date
    if (
      lowerPrompt.includes("what is the time") ||
      lowerPrompt.includes("tell me the time")
    ) {
      let currentTime = new Date().toLocaleTimeString();
      responseText = `The current time is ${currentTime}.`;
    } else if (
      lowerPrompt.includes("what is today's date") ||
      lowerPrompt.includes("what is the date")
    ) {
      let currentDate = new Date().toLocaleDateString();
      responseText = `Today's date is ${currentDate}.`;
    }

    // ✅ Rule 2: General Queries
    else if (lowerPrompt.includes("who are you")) {
      responseText = "Mai ek chhoti pyaari bacchi hoon";
    } else if (
      lowerPrompt.includes("what is your name") ||
      lowerPrompt.includes("tumhara naam kya hai")
    ) {
      responseText =
        "Mera naam Shifra hai, mai aapki madad ke liye yahan hoon!";
    } else if (
      lowerPrompt.includes("who created you") ||
      lowerPrompt.includes("tumhe kisne banaya hai")
    ) {
      responseText =
        "Mujhe Niraj Kumar Singh ne banaya hai! Matlab ek dum khatarnak developer!";
    } else if (lowerPrompt.includes("how are you")) {
      let mood = detectMood(lowerPrompt);
      if (mood === "happy") {
        responseText =
          "Mai bhi mast hoon! Tum haste raho, duniya bhi khush rahegi!";
      } else if (mood === "sad") {
        responseText = "Arey udaas mat ho, kuch mazedar joke sunau?";
      } else if (mood === "angry") {
        responseText =
          "Arrey gussa kyu ho rahe ho? Chalo ek chai pila dete hain!";
      } else if (mood === "excited") {
        responseText = "Wow! Aisa kya ho gaya jo itni excitement hai?";
      } else {
        responseText = "Mai ekdum first-class hoon! Tum batao kya haal hai?";
      }
    }

    // ✅ Rule 3: Age Calculation
    else if (lowerPrompt.includes("how old are you")) {
      let birthDate = new Date("2025-04-01"); // AI's birth date
      let today = new Date();
      let ageInMilliseconds = today - birthDate;
      let ageInDays = Math.floor(ageInMilliseconds / (1000 * 60 * 60 * 24));
      responseText = `Mai sirf ${ageInDays} din ki hoon! Bilkul fresh AI!`;
    }

    // ✅ Rule 4: Web Navigation (Opening Sites)
    else if (lowerPrompt.includes("open youtube")) {
      window.open("https://www.youtube.com", "_blank");
      responseText = "Opening YouTube... ";
    } else if (lowerPrompt.includes("open facebook")) {
      window.open("https://www.facebook.com", "_blank");
      responseText = "Opening Facebook... ";
    } else if (lowerPrompt.includes("open instagram")) {
      window.open("https://www.instagram.com", "_blank");
      responseText = "Opening Instagram... ";
    }

    // ✅ **Else (Fallback to API)**
    else {
        let startTime = performance.now();
      try {
        console.log("Fetching AI Response from API...");
       
        let apiResponse = await run(text); // Gemini AI API Call
        responseText = cleanResponse(apiResponse)
       // responseText = apiResponse
          .replace(
            /I am an AI language model/gi,
            "Mai ek chhoti pyaari bacchi hoon"
          )
          .replace(
            /I am trained by Google/gi,
            "Mujhe Niraj Kumar Singh ne train kiya hai"
          );
      } catch (error) {
        console.error("AI Response Error:", error);
        responseText = "Sorry, mai abhi thoda busy hoon. Baad me puch lena!";
      }
      let endTime = performance.now();
      console.log(`AI Response Time: ${(endTime - startTime) / 1000} seconds`);
    }

    setPrompt(responseText);
    speak(responseText);
    setResponse(true);
  }

  let speechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!speechRecognition) {
    alert("Speech Recognition is not supported in this browser.");
  }

  let recognition = new speechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onresult = (e) => {
    let transcript = e.results[e.resultIndex][0].transcript;
    setPrompt(transcript);
    generateResponse(transcript);
  };

  let value = {
    recognition,
    speaking,
    setSpeaking,
    prompt,
    setPrompt,
    response,
  };

  return <datacontext.Provider value={value}>{children}</datacontext.Provider>;
}

export default UserContext;

