import React, { useContext } from 'react';
import "./App.css";
import va from "./assets/ai.png";
import speakimg from "./assets/speak.gif";
import aigif from "./assets/aiVoice.gif";
import { CiMicrophoneOn } from "react-icons/ci";
import { datacontext } from './context/UserContext';

function App() {
  let { recognition, speaking, setSpeaking, prompt, response, setPrompt } = useContext(datacontext);

  const startListening = () => {
    if (!recognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    setPrompt("Listening...");
    setSpeaking(true);
    setTimeout(() => recognition.start(), 500); // Ensures smooth start
  };

  return (
    <div className="main">
      <img src={va} alt="shipra" id="shifra" />
      <span>I'm Shifra, Your Advanced Voice Assistant</span>

      {!speaking ? (
        <button onClick={startListening}>Click here <CiMicrophoneOn /></button>
      ) : (
        <div className="response">
          {!response ? (
            <img src={speakimg} alt="Speaking..." id="speakimg" />
          ) : (
            <img src={aigif} alt="AI Responding..." id="aigif" />
          )}
          <p className="prompt">{prompt}</p>
        </div>
      )}
    </div>
  );
}

export default App;
