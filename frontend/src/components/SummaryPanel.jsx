import { generateMeetingPDF } from "../utils/generatePDF";

export default function SummaryPanel({ summary, messages = [] }) {
  const hasSummary = summary?.summary || summary?.key_topics?.length || summary?.action_items?.length;
  const hasMessages = messages.length > 0;

  if (!summary) {
    return (
      <div className="panel summary-panel">
        <div className="panel-header">
          <div className="panel-title">
            <span className="panel-eyebrow">04 · Summary</span>
            <span className="panel-heading">Meeting summary</span>
          </div>
        </div>
        <div className="panel-body">
          <div className="empty-state">
            Summary will appear after processing.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel summary-panel">
      <div className="panel-header">
        <div className="panel-title">
          <span className="panel-eyebrow">04 · Summary</span>
          <span className="panel-heading">Meeting summary</span>
        </div>
        {(hasSummary || hasMessages) && (
          <button
            className="download-pdf-btn"
            onClick={() => generateMeetingPDF(summary, messages)}
            title="Download PDF report"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download PDF
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
              {summary.key_topics.map((topic, index) => (
                <li key={index}>{topic}</li>
              ))}
            </ul>
          </div>
        )}

        {summary.action_items?.length > 0 && (
          <div className="summary-block">
            <h4>Action Items</h4>
            <ul className="summary-checklist">
              {summary.action_items.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {!summary.summary &&
          !summary.key_topics?.length &&
          !summary.action_items?.length && (
            <div className="empty-state">
              Summary data is available but no structured fields were found.
            </div>
          )}
      </div>
    </div>
  );
}
