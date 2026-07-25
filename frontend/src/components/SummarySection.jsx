"use client";

export default function SummarySection({ summary }) {
  return (
    <>
      <div className="summary-card">
        <h2>📄 Meeting Summary</h2>

        <div className="section">
          <h3>Summary</h3>
          <p>{summary.summary}</p>
        </div>

        <div className="section">
          <h3>Key Topics</h3>
          <ul>
            {summary.key_topics?.map((topic, index) => (
              <li key={index}>{topic}</li>
            ))}
          </ul>
        </div>

        <div className="section">
          <h3>Action Items</h3>
          <ul>
            {summary.action_items?.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <style jsx>{`
        .summary-card {
          width: 100%;
          max-width: 900px;
          margin: 30px auto;
          padding: 25px;
          border-radius: 15px;
          background: #1e293b;
          color: #f8fafc;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        }

        h2 {
          text-align: center;
          margin-bottom: 25px;
          color: #06b6d4;
        }

        .section {
          margin-bottom: 25px;
        }

        .section h3 {
          color: #7c3aed;
          margin-bottom: 12px;
          border-left: 4px solid #7c3aed;
          padding-left: 10px;
        }

        p {
          line-height: 1.8;
          color: #e2e8f0;
          text-align: justify;
        }

        ul {
          padding-left: 20px;
          margin-top: 10px;
        }

        li {
          margin-bottom: 10px;
          line-height: 1.6;
          color: #cbd5e1;
        }

        @media (max-width: 768px) {
          .summary-card {
            margin: 20px 10px;
            padding: 18px;
          }

          h2 {
            font-size: 1.5rem;
          }

          .section h3 {
            font-size: 1.1rem;
          }
        }
      `}</style>
    </>
  );
}