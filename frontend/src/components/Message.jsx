"use client";

export default function Message({ sender, text }) {
  return (
    <>
      <div className={`message ${sender}`}>
        <strong>{sender === "user" ? "You" : "AI"}</strong>
        <p>{text}</p>
      </div>

      <style jsx>{`
        .message {
          margin-bottom: 15px;
          padding: 12px 15px;
          border-radius: 12px;
          max-width: 80%;
          word-wrap: break-word;
          animation: fadeIn 0.25s ease-in-out;
        }

        .user {
          margin-left: auto;
          background: #7c3aed;
          color: white;
        }

        .bot {
          margin-right: auto;
          background: #334155;
          color: #f8fafc;
        }

        strong {
          display: block;
          margin-bottom: 6px;
          color: #06b6d4;
          font-size: 14px;
        }

        p {
          margin: 0;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 768px) {
          .message {
            max-width: 100%;
          }
        }
      `}</style>
    </>
  );
}