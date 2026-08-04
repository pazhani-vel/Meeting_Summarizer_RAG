// "use client";

// import { useState } from "react";

// import Message from "./Message";

// import { askQuestion } from "../services/api";

// export default function ChatSection({ videoId }) {
//   const [question, setQuestion] = useState("");
//   const [messages, setMessages] = useState([]);
//   const [loading, setLoading] = useState(false);

//   const sendQuestion = async () => {
//     if (!question.trim()) return;

//     const userMessage = {
//       sender: "user",
//       text: question,
//     };

//     setMessages((prev) => [...prev, userMessage]);
//     setLoading(true);

//     try {
//      const data = await askQuestion(videoId, question);

// const botMessage = {
//   sender: "bot",
//   text: data.answer,
// };

// setMessages((prev) => [...prev, botMessage]);
//     } catch (error) {
//       setMessages((prev) => [
//         ...prev,
//         {
//           sender: "bot",
//           text: "Something went wrong while fetching the answer.",
//         },
//       ]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <>
//       <div className="chat-card">
//         <h2>💬 Ask Questions</h2>

//         <div className="chat-box">
//           {messages.length === 0 && (
//             <p className="placeholder">
//               Ask anything about the uploaded meeting...
//             </p>
//           )}

//           {messages.map((msg, index) => (
//   <Message
//     key={index}
//     sender={msg.sender}
//     text={msg.text}
//   />
// ))}

//           {loading && (
//   <Message
//     sender="bot"
//     text="Thinking..."
//   />
// )}
//         </div>

//         <div className="input-area">
//           <input
//             type="text"
//             placeholder="Ask a question..."
//             value={question}
//             onChange={(e) => setQuestion(e.target.value)}
//             onKeyDown={(e) => {
//               if (e.key === "Enter") {
//                 sendQuestion();
//               }
//             }}
//           />

//           <button onClick={sendQuestion}>
//             Send
//           </button>
//         </div>
//       </div>

//       <style jsx>{`
//         .chat-card {
//           width: 100%;
//           max-width: 900px;
//           margin: 40px auto;
//           background: #1e293b;
//           border-radius: 15px;
//           padding: 25px;
//           color: white;
//           box-shadow: 0 8px 20px rgba(0,0,0,0.3);
//         }

//         h2 {
//           text-align: center;
//           color: #06b6d4;
//           margin-bottom: 20px;
//         }

//         .chat-box {
//           height: 450px;
//           overflow-y: auto;
//           background: #0f172a;
//           border-radius: 10px;
//           padding: 15px;
//           margin-bottom: 20px;
//         }

//         .placeholder {
//           color: #94a3b8;
//           text-align: center;
//           margin-top: 150px;
//         }

//         .message {
//           margin-bottom: 15px;
//           padding: 12px;
//           border-radius: 10px;
//           max-width: 80%;
//         }

//         .user {
//           background: #7c3aed;
//           margin-left: auto;
//         }

//         .bot {
//           background: #334155;
//           margin-right: auto;
//         }

//         .message strong {
//           display: block;
//           margin-bottom: 5px;
//           color: #06b6d4;
//         }

//         .message p {
//           margin: 0;
//           line-height: 1.6;
//           white-space: pre-wrap;
//         }

//         .input-area {
//           display: flex;
//           gap: 10px;
//         }

//         .input-area input {
//           flex: 1;
//           padding: 14px;
//           border-radius: 10px;
//           border: none;
//           outline: none;
//           background: #0f172a;
//           color: white;
//           font-size: 15px;
//         }

//         .input-area button {
//           width: 120px;
//           border: none;
//           background: #7c3aed;
//           color: white;
//           font-weight: bold;
//           border-radius: 10px;
//           cursor: pointer;
//           transition: 0.3s;
//         }

//         .input-area button:hover {
//           background: #6d28d9;
//         }

//         @media (max-width: 768px) {
//           .chat-card {
//             margin: 20px 10px;
//             padding: 18px;
//           }

//           .chat-box {
//             height: 350px;
//           }

//           .input-area {
//             flex-direction: column;
//           }

//           .input-area button {
//             width: 100%;
//           }

//           .message {
//             max-width: 100%;
//           }
//         }
//       `}</style>
//     </>
//   );
// }

"use client";

import { useEffect, useRef, useState } from "react";

import Message from "./Message";

import { askQuestion } from "../services/api";

export default function ChatSection({ videoId, status }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
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
        { sender: "bot", text: data.answer },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "Something went wrong while fetching the answer.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="chat-card">
        <div className="chat-head">
          <div>
            <span className="eyebrow">02 · Ask</span>
            <h2>Ask about the meeting</h2>
          </div>
          <span className="status-chip" data-status={status || "idle"}>
            {status === "processing"
              ? "Processing"
              : ready
              ? "Ready"
              : "Waiting for video"}
          </span>
        </div>

        <div className="chat-box" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="placeholder">
              {ready ? (
                <>
                  <p className="placeholder-title">Ask anything about it</p>
                  <p className="placeholder-sub">
                    Try "What decisions were made?" or "List the action
                    items."
                  </p>
                </>
              ) : (
                <>
                  <p className="placeholder-title">
                    {status === "processing"
                      ? "Analyzing your video…"
                      : "No video yet"}
                  </p>
                  <p className="placeholder-sub">
                    {status === "processing"
                      ? "The chat unlocks as soon as the transcript is ready."
                      : "Upload a recording on the left to start asking questions."}
                  </p>
                </>
              )}
            </div>
          )}

          {messages.map((msg, index) => (
            <Message key={index} sender={msg.sender} text={msg.text} />
          ))}

          {loading && <Message sender="bot" text="Thinking…" />}
        </div>

        <div className="input-area">
          <input
            type="text"
            placeholder={
              ready ? "Ask a question…" : "Upload a video to start chatting"
            }
            value={question}
            disabled={!ready}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendQuestion();
            }}
          />

          <button onClick={sendQuestion} disabled={!ready || !question.trim()}>
            Send
          </button>
        </div>
      </div>

      <style jsx>{`
        .chat-card {
          width: 100%;
          display: flex;
          flex-direction: column;
          background: var(--bg-panel);
          border: 1px solid var(--border-soft);
          border-radius: 16px;
          padding: 22px;
        }

        .chat-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .eyebrow {
          display: block;
          font-family: var(--font-mono);
          font-size: 10.5px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--accent-cyan);
          margin-bottom: 6px;
        }

        h2 {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 600;
          margin: 0;
        }

        .status-chip {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.06em;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--border-soft);
          color: var(--text-muted);
          white-space: nowrap;
          flex-shrink: 0;
        }

        .status-chip[data-status="ready"] {
          color: var(--accent-green);
          border-color: rgba(52, 211, 153, 0.35);
          background: rgba(52, 211, 153, 0.08);
        }

        .status-chip[data-status="processing"] {
          color: var(--accent-amber);
          border-color: rgba(251, 191, 36, 0.35);
          background: rgba(251, 191, 36, 0.08);
        }

        .chat-box {
          flex: 1;
          min-height: 420px;
          overflow-y: auto;
          background: var(--bg-panel-alt);
          border-radius: 12px;
          padding: 18px;
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
        }

        .placeholder {
          margin: auto;
          text-align: center;
          max-width: 280px;
        }

        .placeholder-title {
          color: var(--text-primary);
          font-weight: 500;
          margin: 0 0 6px;
        }

        .placeholder-sub {
          color: var(--text-muted);
          font-size: 13px;
          line-height: 1.5;
          margin: 0;
        }

        .input-area {
          display: flex;
          gap: 10px;
        }

        .input-area input {
          flex: 1;
          padding: 13px 14px;
          border-radius: 10px;
          border: 1px solid var(--border-soft);
          outline: none;
          background: var(--bg-panel-alt);
          color: var(--text-primary);
          font-size: 14.5px;
          font-family: var(--font-body);
        }

        .input-area input:focus {
          border-color: var(--accent-cyan);
        }

        .input-area input:disabled {
          cursor: not-allowed;
          color: var(--text-muted);
        }

        .input-area button {
          width: 96px;
          border: none;
          background: linear-gradient(
            90deg,
            var(--accent-violet),
            var(--accent-cyan)
          );
          color: #06101f;
          font-weight: 600;
          font-size: 14px;
          border-radius: 10px;
          cursor: pointer;
          transition: opacity 0.2s ease;
        }

        .input-area button:hover:not(:disabled) {
          opacity: 0.92;
        }

        .input-area button:disabled {
          background: var(--bg-panel-alt);
          color: var(--text-muted);
          border: 1px solid var(--border-soft);
          cursor: not-allowed;
        }

        @media (max-width: 980px) {
          .chat-box {
            min-height: 320px;
          }
        }
      `}</style>
    </>
  );
}