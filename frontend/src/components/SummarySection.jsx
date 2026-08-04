// "use client";

// export default function SummarySection({ summary }) {
//   return (
//     <>
//       <div className="summary-card">
//         <h2>📄 Meeting Summary</h2>

//         <div className="section">
//           <h3>Summary</h3>
//           <p>{summary.summary}</p>
//         </div>

//         <div className="section">
//           <h3>Key Topics</h3>
//           <ul>
//             {summary.key_topics?.map((topic, index) => (
//               <li key={index}>{topic}</li>
//             ))}
//           </ul>
//         </div>

//         <div className="section">
//           <h3>Action Items</h3>
//           <ul>
//             {summary.action_items?.map((item, index) => (
//               <li key={index}>{item}</li>
//             ))}
//           </ul>
//         </div>
//       </div>

//       <style jsx>{`
//         .summary-card {
//           width: 100%;
//           max-width: 900px;
//           margin: 30px auto;
//           padding: 25px;
//           border-radius: 15px;
//           background: #1e293b;
//           color: #f8fafc;
//           box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
//         }

//         h2 {
//           text-align: center;
//           margin-bottom: 25px;
//           color: #06b6d4;
//         }

//         .section {
//           margin-bottom: 25px;
//         }

//         .section h3 {
//           color: #7c3aed;
//           margin-bottom: 12px;
//           border-left: 4px solid #7c3aed;
//           padding-left: 10px;
//         }

//         p {
//           line-height: 1.8;
//           color: #e2e8f0;
//           text-align: justify;
//         }

//         ul {
//           padding-left: 20px;
//           margin-top: 10px;
//         }

//         li {
//           margin-bottom: 10px;
//           line-height: 1.6;
//           color: #cbd5e1;
//         }

//         @media (max-width: 768px) {
//           .summary-card {
//             margin: 20px 10px;
//             padding: 18px;
//           }

//           h2 {
//             font-size: 1.5rem;
//           }

//           .section h3 {
//             font-size: 1.1rem;
//           }
//         }
//       `}</style>
//     </>
//   );
// }


"use client";

export default function SummarySection({ summary }) {
  return (
    <>
      <div className="summary-card">
        <span className="eyebrow">Digest</span>

        <div className="block">
          <h3>Summary</h3>
          <p>{summary.summary}</p>
        </div>

        {summary.key_topics?.length > 0 && (
          <div className="block">
            <h3>Key topics</h3>
            <ul className="chips">
              {summary.key_topics.map((topic, index) => (
                <li key={index}>{topic}</li>
              ))}
            </ul>
          </div>
        )}

        {summary.action_items?.length > 0 && (
          <div className="block">
            <h3>Action items</h3>
            <ul className="checklist">
              {summary.action_items.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <style jsx>{`
        .summary-card {
          background: var(--bg-panel);
          border: 1px solid var(--border-soft);
          border-radius: 16px;
          padding: 22px;
        }

        .eyebrow {
          display: block;
          font-family: var(--font-mono);
          font-size: 10.5px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--accent-cyan);
          margin-bottom: 16px;
        }

        .block {
          margin-bottom: 20px;
        }

        .block:last-child {
          margin-bottom: 0;
        }

        h3 {
          font-family: var(--font-display);
          font-size: 13.5px;
          font-weight: 600;
          margin: 0 0 10px;
          color: var(--text-primary);
        }

        p {
          margin: 0;
          line-height: 1.7;
          color: var(--text-muted);
          font-size: 13.5px;
        }

        .chips {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .chips li {
          font-size: 12.5px;
          padding: 6px 11px;
          border-radius: 999px;
          background: rgba(139, 92, 246, 0.12);
          border: 1px solid rgba(139, 92, 246, 0.3);
          color: #cbb9ff;
        }

        .checklist {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .checklist li {
          position: relative;
          padding-left: 20px;
          font-size: 13.5px;
          line-height: 1.55;
          color: var(--text-primary);
        }

        .checklist li::before {
          content: "";
          position: absolute;
          left: 0;
          top: 6px;
          width: 9px;
          height: 9px;
          border-radius: 3px;
          border: 1.5px solid var(--accent-cyan);
        }
      `}</style>
    </>
  );
}