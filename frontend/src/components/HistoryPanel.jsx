import { useState } from "react";

const STATUS_MAP = {
  pending:      { label: "Pending",      cls: "pending" },
  extracting:   { label: "Extracting",   cls: "processing" },
  transcribing: { label: "Transcribing", cls: "processing" },
  diarizing:    { label: "Diarizing",    cls: "processing" },
  summarizing:  { label: "Summarizing",  cls: "processing" },
  ready:        { label: "Ready",        cls: "ready" },
  failed:       { label: "Failed",       cls: "failed" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_MAP[status] || STATUS_MAP.pending;
  const isProcessing = ["pending", "extracting", "transcribing", "diarizing", "summarizing"].includes(status);
  return (
    <span className={`status-badge ${cfg.cls}`}>
      {isProcessing && <span className="status-spinner" />}
      {cfg.label}
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch { return ""; }
}

function formatDuration(sec) {
  if (!sec) return null;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function HistoryPanel({
  open,
  meetings,
  onSelect,
  onDelete,
  onNewMeeting,
  loadingMeeting,
  currentMeetingId,
}) {
  const [confirmDelete, setConfirmDelete] = useState(null);

  if (!open) return null;

  const handleDelete = (meetingId) => {
    if (confirmDelete === meetingId) {
      onDelete(meetingId);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(meetingId);
    }
  };

  return (
    <div className="history-panel">
      <div className="history-panel-header">
        <h3>Meeting History</h3>
        <button className="btn-new-meeting" onClick={onNewMeeting}>
          + New
        </button>
      </div>

      <div className="history-list">
        {meetings.length === 0 ? (
          <div className="history-empty">
            <div className="history-empty-icon">📁</div>
            <p>No meetings yet</p>
            <p className="history-empty-sub">Upload a video to get started.</p>
          </div>
        ) : (
          meetings.map((m) => {
            const isActive = m.meeting_id === currentMeetingId;
            const isConfirming = confirmDelete === m.meeting_id;
            const duration = formatDuration(m.duration_sec);

            return (
              <div key={m.meeting_id} className={`history-item ${isActive ? "active" : ""}`}>
                <button
                  className="history-item-btn"
                  onClick={() => { onSelect(m); setConfirmDelete(null); }}
                  disabled={loadingMeeting}
                >
                  <div className="history-item-top">
                    <span className="history-item-title">
                      {m.filename || "Untitled"}
                    </span>
                    <StatusBadge status={m.status} />
                  </div>
                  <div className="history-item-meta">
                    <span>{formatDate(m.created_at)}</span>
                    {duration && <span>{duration}</span>}
                    {m.summary_preview && (
                      <span className="history-item-preview">{m.summary_preview}</span>
                    )}
                  </div>
                </button>

                <div className="history-item-actions">
                  {isConfirming ? (
                    <div className="delete-confirm">
                      <span className="delete-confirm-text">Delete?</span>
                      <button
                        className="btn-confirm-yes"
                        onClick={(e) => { e.stopPropagation(); handleDelete(m.meeting_id); }}
                      >Yes</button>
                      <button
                        className="btn-confirm-no"
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}
                      >No</button>
                    </div>
                  ) : (
                    <button
                      className="btn-delete"
                      onClick={(e) => { e.stopPropagation(); handleDelete(m.meeting_id); }}
                      title="Delete meeting"
                    >×</button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
