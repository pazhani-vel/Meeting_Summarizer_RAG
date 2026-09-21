import { generateMeetingPDF } from "../utils/generatePDF";

export default function SummaryPanel({ summary, messages = [] }) {
  const hasContent = summary?.summary || summary?.key_topics?.length || summary?.action_items?.length;

  if (!summary) {
    return (
      <>
        <div className="panel-header">
          <div className="panel-title">
            <span className="panel-eyebrow">Summary</span>
            <span className="panel-heading">AI Summary</span>
          </div>
        </div>
        <div className="panel-body">
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">No summary yet</div>
            <div className="empty-state-sub">Upload a video to generate an AI summary.</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="panel-header">
        <div className="panel-title">
          <span className="panel-eyebrow">Summary</span>
          <span className="panel-heading">AI Summary</span>
        </div>
        {hasContent && (
          <button
            className="btn-download"
            onClick={() => generateMeetingPDF(summary, messages)}
            title="Download PDF report"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            PDF
          </button>
        )}
      </div>
      <div className="panel-body">
        {summary.summary && (
          <div className="summary-block">
            <h4>Overview</h4>
            <p>{summary.summary}</p>
          </div>
        )}

        {summary.key_topics?.length > 0 && (
          <div className="summary-block">
            <h4>Key Topics</h4>
            <ul className="summary-chips">
              {summary.key_topics.map((topic, i) => (
                <li key={i}>{topic}</li>
              ))}
            </ul>
          </div>
        )}

        {summary.action_items?.length > 0 && (
          <div className="summary-block">
            <h4>Action Items</h4>
            <ul className="summary-checklist">
              {summary.action_items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {!summary.summary && !summary.key_topics?.length && !summary.action_items?.length && (
          <div className="empty-state">
            <div className="empty-state-sub">Summary data available but no structured fields found.</div>
          </div>
        )}
      </div>
    </>
  );
}
