import { useRef, useState, useCallback } from "react";

import "./App.css";

import Header from "./components/Header";
import VideoPanel from "./components/VideoPanel";
import Transcript from "./components/Transcript";
import SummaryPanel from "./components/SummaryPanel";
import ChatPanel from "./components/ChatPanel";

function App() {
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [videoId, setVideoId] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [messages, setMessages] = useState([]);

  const videoRef = useRef(null);

  const ready = Boolean(videoId);
  const status = uploading ? "processing" : ready ? "ready" : "idle";

  // --- Resize: left vs right ---
  const [leftFlex, setLeftFlex] = useState(1);
  const [rightFlex, setRightFlex] = useState(1);
  const dragRef = useRef(null);

  const onMouseDownCol = useCallback(
    (e) => {
      e.preventDefault();
      dragRef.current = "col";
      const startX = e.clientX;
      const startLeft = leftFlex;
      const startRight = rightFlex;

      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        const newLeft = Math.max(0.3, startLeft + dx / 300);
        const newRight = Math.max(0.3, startRight - dx / 300);
        setLeftFlex(newLeft);
        setRightFlex(newRight);
      };
      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [leftFlex, rightFlex]
  );

  // --- Resize: top vs bottom (left side) ---
  const [leftTopFlex, setLeftTopFlex] = useState(1.2);
  const [leftBotFlex, setLeftBotFlex] = useState(1);
  const dragLeftRef = useRef(null);

  const onMouseDownRowLeft = useCallback(
    (e) => {
      e.preventDefault();
      dragLeftRef.current = "row";
      const startY = e.clientY;
      const startTop = leftTopFlex;
      const startBot = leftBotFlex;

      const onMove = (ev) => {
        const dy = ev.clientY - startY;
        const newTop = Math.max(0.3, startTop + dy / 200);
        const newBot = Math.max(0.3, startBot - dy / 200);
        setLeftTopFlex(newTop);
        setLeftBotFlex(newBot);
      };
      const onUp = () => {
        dragLeftRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [leftTopFlex, leftBotFlex]
  );

  // --- Resize: top vs bottom (right side) ---
  const [rightTopFlex, setRightTopFlex] = useState(0.7);
  const [rightBotFlex, setRightBotFlex] = useState(1);
  const dragRightRef = useRef(null);

  const onMouseDownRowRight = useCallback(
    (e) => {
      e.preventDefault();
      dragRightRef.current = "row";
      const startY = e.clientY;
      const startTop = rightTopFlex;
      const startBot = rightBotFlex;

      const onMove = (ev) => {
        const dy = ev.clientY - startY;
        const newTop = Math.max(0.2, startTop + dy / 200);
        const newBot = Math.max(0.3, startBot - dy / 200);
        setRightTopFlex(newTop);
        setRightBotFlex(newBot);
      };
      const onUp = () => {
        dragRightRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [rightTopFlex, rightBotFlex]
  );

  return (
    <div className="app">
      <Header status={status} />

      <div className="dashboard">
        {/* LEFT SIDE: Video + Transcript */}
        <div
          className="dashboard-left"
          style={{ flex: leftFlex }}
        >
          <div style={{ flex: leftTopFlex, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <VideoPanel
              uploading={uploading}
              setUploading={setUploading}
              setSummary={setSummary}
              setVideoId={setVideoId}
              setTranscript={setTranscript}
              previewUrl={previewUrl}
              setPreviewUrl={setPreviewUrl}
              videoRef={videoRef}
              setCurrentTime={setCurrentTime}
            />
          </div>

          <div
            className="resize-handle resize-handle-h"
            onMouseDown={onMouseDownRowLeft}
          />

          <div style={{ flex: leftBotFlex, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <Transcript
              transcript={transcript}
              currentTime={currentTime}
              videoRef={videoRef}
            />
          </div>
        </div>

        {/* CENTER RESIZE */}
        <div className="resize-handle" onMouseDown={onMouseDownCol} />

        {/* RIGHT SIDE: Summary + Chat */}
        <div
          className="dashboard-right"
          style={{ flex: rightFlex }}
        >
          <div style={{ flex: rightTopFlex, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <SummaryPanel summary={summary} messages={messages} />
          </div>

          <div
            className="resize-handle resize-handle-h"
            onMouseDown={onMouseDownRowRight}
          />

          <div style={{ flex: rightBotFlex, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <ChatPanel videoId={videoId} status={status} messages={messages} setMessages={setMessages} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
