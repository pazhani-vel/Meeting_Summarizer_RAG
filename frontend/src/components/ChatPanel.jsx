import { useEffect, useRef, useState } from "react";

import { askQuestion } from "../services/api";

const SUGGESTED_QUESTIONS = [
  "What were the main decisions?",
  "What action items were discussed?",
  "Summarize the key points",
  "Who spoke the most?",
];

export default function ChatPanel({ videoId, status, messages, setMessages }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const ready = Boolean(videoId);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const sendQuestion = async (text) => {
    const q = text || question.trim();
    if (!q || !ready || loading) return;

    const userMessage = { sender: "user", text: q };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setLoading(true);

    try {
      const data = await askQuestion(videoId, q);
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: data.answer, sources: data.sources || [] },
      ]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "Unable to get an answer. Please try again.", sources: [] },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="panel-header">
        <div className="panel-title">
          <span className="panel-eyebrow">Chat</span>
          <span className="panel-heading">Meeting Chatbot</span>
        </div>
      </div>

      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat-placeholder">
            <div className="chat-placeholder-icon">💬</div>
            {ready ? (
              <>
                <div className="chat-placeholder-title">Ask anything about this meeting</div>
                <div className="chat-placeholder-examples">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <div
                      key={q}
                      style={{ cursor: "pointer", padding: "3px 0" }}
                      onClick={() => sendQuestion(q)}
                    >
                      • {q}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="chat-placeholder-title">
                  {status === "processing"
                    ? "Processing your meeting…"
                    : "No meeting loaded"}
                </div>
                <div className="chat-placeholder-sub">
                  {status === "processing"
                    ? "The chat will unlock once processing is complete."
                    : "Upload a video to start chatting."}
                </div>
              </>
            )}
          </div>
        )}

        {messages.map((msg, index) => (
          <ChatMessage key={index} message={msg} />
        ))}

        {loading && (
          <div className="chat-row bot">
            <span className="chat-avatar">AI</span>
            <div className="chat-bubble">
              <div className="thinking-dots">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="chat-input-area">
        <input
          className="chat-input"
          type="text"
          placeholder={ready ? "Ask a question…" : "Upload a video to start chatting"}
          value={question}
          disabled={!ready}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") sendQuestion(); }}
        />
        <button
          className="btn-send"
          onClick={() => sendQuestion()}
          disabled={!ready || !question.trim() || loading}
        >
          Send
        </button>
      </div>
    </>
  );
}

function ChatMessage({ message }) {
  const [showSources, setShowSources] = useState(false);
  const isUser = message.sender === "user";

  return (
    <div className={`chat-row ${isUser ? "user" : "bot"}`}>
      <span className="chat-avatar">{isUser ? "You" : "AI"}</span>
      <div className="chat-bubble">
        <p>{message.text}</p>
        {!isUser && message.sources?.length > 0 && (
          <div className="chat-sources">
            <button
              className="chat-sources-toggle"
              onClick={() => setShowSources(!showSources)}
            >
              {showSources ? "▾" : "▸"} Sources ({message.sources.length})
            </button>
            {showSources && (
              <ul className="chat-sources-list">
                {message.sources.map((source, i) => (
                  <li key={i}>
                    {typeof source === "string" ? source : `Chunk ${i + 1}`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
