import React from "react";
import AudioRecorder from "./components/AudioRecorder";

function App() {
  return (
    <div className="flex justify-center items-center h-screen w-screen bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
      <AudioRecorder />
    </div>
  );
}

export default App;
