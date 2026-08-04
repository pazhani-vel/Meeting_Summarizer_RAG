// "use client";

// export default function Message({ sender, text }) {
//   return (
//     <>
//       <div className={`message ${sender}`}>
//         <strong>{sender === "user" ? "You" : "AI"}</strong>
//         <p>{text}</p>
//       </div>

//       <style jsx>{`
//         .message {
//           margin-bottom: 15px;
//           padding: 12px 15px;
//           border-radius: 12px;
//           max-width: 80%;
//           word-wrap: break-word;
//           animation: fadeIn 0.25s ease-in-out;
//         }

//         .user {
//           margin-left: auto;
//           background: #7c3aed;
//           color: white;
//         }

//         .bot {
//           margin-right: auto;
//           background: #334155;
//           color: #f8fafc;
//         }

//         strong {
//           display: block;
//           margin-bottom: 6px;
//           color: #06b6d4;
//           font-size: 14px;
//         }

//         p {
//           margin: 0;
//           line-height: 1.6;
//           white-space: pre-wrap;
//         }

//         @keyframes fadeIn {
//           from {
//             opacity: 0;
//             transform: translateY(10px);
//           }
//           to {
//             opacity: 1;
//             transform: translateY(0);
//           }
//         }

//         @media (max-width: 768px) {
//           .message {
//             max-width: 100%;
//           }
//         }
//       `}</style>
//     </>
//   );
// }


"use client";

export default function Message({ sender, text }) {
  const isUser = sender === "user";

  return (
    <>
      <div className={`row ${isUser ? "user" : "bot"}`}>
        <span className="avatar">{isUser ? "You" : "AI"}</span>
        <div className="bubble">
          <p>{text}</p>
        </div>
      </div>

      <style jsx>{`
        .row {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          margin-bottom: 14px;
          max-width: 88%;
          animation: fadeIn 0.25s ease-in-out;
        }

        .user {
          margin-left: auto;
          flex-direction: row-reverse;
        }

        .bot {
          margin-right: auto;
        }

        .avatar {
          flex-shrink: 0;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-mono);
          font-size: 9.5px;
          letter-spacing: 0.02em;
          color: #06101f;
          font-weight: 600;
        }

        .user .avatar {
          background: var(--accent-violet);
        }

        .bot .avatar {
          background: var(--accent-cyan);
        }

        .bubble {
          padding: 11px 14px;
          border-radius: 12px;
          min-width: 0;
        }

        .user .bubble {
          background: var(--accent-violet);
          color: white;
          border-bottom-right-radius: 4px;
        }

        .bot .bubble {
          background: #1c2740;
          color: var(--text-primary);
          border-bottom-left-radius: 4px;
        }

        p {
          margin: 0;
          line-height: 1.6;
          font-size: 14px;
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 768px) {
          .row {
            max-width: 100%;
          }
        }
      `}</style>
    </>
  );
}