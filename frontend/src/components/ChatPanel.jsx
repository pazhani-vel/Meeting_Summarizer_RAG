import { useEffect, useRef, useState } from "react";

import { askQuestion } from "../services/api";

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

  const sendQuestion = async () => {
    if (!question.trim() || !ready || loading) return;

    const userMessage = { sender: "user", text: question };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setLoading(true);

    try {
      const data = await askQuestion(videoId, userMessage.text);

      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: data.answer,
          sources: data.sources || [],
        },
      ]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "Unable to get an answer. Please try again.",
          sources: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel chat-panel">
      <div className="panel-header">
        <div className="panel-title">
          <span className="panel-eyebrow">05 · Chat</span>
          <span className="panel-heading">Ask about the meeting</span>
        </div>
      </div>

      <div className="panel-body chat-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat-placeholder">
            <div className="chat-placeholder-icon">💬</div>
            {ready ? (
              <>
                <p className="chat-placeholder-title">
                  Ask anything about this meeting
                </p>
                <div className="chat-placeholder-examples">
                  Examples:
                  <br />• What was discussed?
                  <br />• What decisions were made?
                  <br />• Who discussed the project?
                  <br />• What are the action items?
                </div>
              </>
            ) : (
              <>
                <p className="chat-placeholder-title">
                  {status === "processing"
                    ? "Processing your meeting..."
                    : "Process a meeting video before asking questions."}
                </p>
                <p className="chat-placeholder-sub">
                  {status === "processing"
                    ? "The chat will unlock once processing is complete."
                    : "Upload and analyze a video to start asking questions."}
                </p>
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
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="chat-input-area">
        <input
          className="chat-input"
          type="text"
          placeholder={
            ready ? "Ask a question..." : "Upload a video to start chatting"
          }
          value={question}
          disabled={!ready}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendQuestion();
          }}
        />
        <button
          className="chat-send-btn"
          onClick={sendQuestion}
          disabled={!ready || !question.trim() || loading}
        >
          Send
        </button>
      </div>
    </div>
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
