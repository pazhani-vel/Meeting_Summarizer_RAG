"use client";

import { useState } from "react";

import Message from "./Message";

import { askQuestion } from "../services/api";

export default function ChatSection({ videoId }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const sendQuestion = async () => {
    if (!question.trim()) return;

    const userMessage = {
      sender: "user",
      text: question,
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
     const data = await askQuestion(videoId, question);

const botMessage = {
  sender: "bot",
  text: data.answer,
};

setMessages((prev) => [...prev, botMessage]);
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
        <h2>💬 Ask Questions</h2>

        <div className="chat-box">
          {messages.length === 0 && (
            <p className="placeholder">
              Ask anything about the uploaded meeting...
            </p>
          )}

          {messages.map((msg, index) => (
  <Message
    key={index}
    sender={msg.sender}
    text={msg.text}
  />
))}

          {loading && (
  <Message
    sender="bot"
    text="Thinking..."
  />
)}
        </div>

        <div className="input-area">
          <input
            type="text"
            placeholder="Ask a question..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                sendQuestion();
              }
            }}
          />

          <button onClick={sendQuestion}>
            Send
          </button>
        </div>
      </div>

      <style jsx>{`
        .chat-card {
          width: 100%;
          max-width: 900px;
          margin: 40px auto;
          background: #1e293b;
          border-radius: 15px;
          padding: 25px;
          color: white;
          box-shadow: 0 8px 20px rgba(0,0,0,0.3);
        }

        h2 {
          text-align: center;
          color: #06b6d4;
          margin-bottom: 20px;
        }

        .chat-box {
          height: 450px;
          overflow-y: auto;
          background: #0f172a;
          border-radius: 10px;
          padding: 15px;
          margin-bottom: 20px;
        }

        .placeholder {
          color: #94a3b8;
          text-align: center;
          margin-top: 150px;
        }

        .message {
          margin-bottom: 15px;
          padding: 12px;
          border-radius: 10px;
          max-width: 80%;
        }

        .user {
          background: #7c3aed;
          margin-left: auto;
        }

        .bot {
          background: #334155;
          margin-right: auto;
        }

        .message strong {
          display: block;
          margin-bottom: 5px;
          color: #06b6d4;
        }

        .message p {
          margin: 0;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .input-area {
          display: flex;
          gap: 10px;
        }

        .input-area input {
          flex: 1;
          padding: 14px;
          border-radius: 10px;
          border: none;
          outline: none;
          background: #0f172a;
          color: white;
          font-size: 15px;
        }

        .input-area button {
          width: 120px;
          border: none;
          background: #7c3aed;
          color: white;
          font-weight: bold;
          border-radius: 10px;
          cursor: pointer;
          transition: 0.3s;
        }

        .input-area button:hover {
          background: #6d28d9;
        }

        @media (max-width: 768px) {
          .chat-card {
            margin: 20px 10px;
            padding: 18px;
          }

          .chat-box {
            height: 350px;
          }

          .input-area {
            flex-direction: column;
          }

          .input-area button {
            width: 100%;
          }

          .message {
            max-width: 100%;
          }
        }
      `}</style>
    </>
  );
}