import { useMemo } from "react";

const SPEAKER_COLORS = [
  "#DC2626", "#8B5CF6", "#22D3EE", "#34D399",
  "#FBBF24", "#F87171", "#38BDF8", "#4ADE80",
];

function formatDuration(sec) {
  if (!sec || sec <= 0) return "0s";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export default function TrackingPanel({ transcript }) {
  const stats = useMemo(() => {
    if (!transcript || transcript.length === 0) return null;

    const speakerMap = {};
    for (const seg of transcript) {
      const sp = seg.speaker || "UNKNOWN";
      if (!speakerMap[sp]) {
        speakerMap[sp] = { name: sp, segments: 0, totalDuration: 0 };
      }
      speakerMap[sp].segments += 1;
      speakerMap[sp].totalDuration += (seg.end || 0) - (seg.start || 0);
    }

    const speakers = Object.values(speakerMap).sort(
      (a, b) => b.totalDuration - a.totalDuration,
    );

    const totalDuration = transcript.length > 0
      ? transcript[transcript.length - 1].end - transcript[0].start
      : 0;

    return { speakers, totalDuration, numSpeakers: speakers.length };
  }, [transcript]);

  if (!transcript || transcript.length === 0) {
    return (
      <>
        <div className="panel-header">
          <div className="panel-title">
            <span className="panel-eyebrow">Tracking</span>
            <span className="panel-heading">Speaker Intelligence</span>
          </div>
        </div>
        <div className="panel-body">
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-title">No speakers detected</div>
            <div className="empty-state-sub">Upload a video to detect speakers.</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="panel-header">
        <div className="panel-title">
          <span className="panel-eyebrow">Tracking</span>
          <span className="panel-heading">Speaker Intelligence</span>
        </div>
        <div className="panel-actions">
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {stats.numSpeakers} speaker{stats.numSpeakers !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="panel-body">
        {/* Stats */}
        <div className="tracking-stats">
          <div className="tracking-stat">
            <div className="tracking-stat-value">{stats.numSpeakers}</div>
            <div className="tracking-stat-label">Speakers</div>
          </div>
          <div className="tracking-stat">
            <div className="tracking-stat-value">{transcript.length}</div>
            <div className="tracking-stat-label">Segments</div>
          </div>
        </div>

        {/* Timeline Bar */}
        <div className="tracking-timeline">
          <div className="info-label">Speaking Timeline</div>
          <div className="tracking-timeline-bar">
            {transcript.map((seg, i) => {
              const width = stats.totalDuration > 0
                ? ((seg.end - seg.start) / stats.totalDuration) * 100
                : 100 / transcript.length;
              const speakerIdx = stats.speakers.findIndex(
                (s) => s.name === seg.speaker,
              );
              return (
                <div
                  key={i}
                  className="tracking-timeline-segment"
                  style={{
                    width: `${width}%`,
                    backgroundColor: SPEAKER_COLORS[speakerIdx % SPEAKER_COLORS.length],
                    opacity: 0.7,
                  }}
                  title={`${seg.speaker} (${formatDuration(seg.end - seg.start)})`}
                />
              );
            })}
          </div>
        </div>

        {/* Speaker List */}
        <div className="info-label">Detected Speakers</div>
        <div className="tracking-speaker-list" style={{ marginTop: 6 }}>
          {stats.speakers.map((sp, i) => {
            const pct = stats.totalDuration > 0
              ? Math.round((sp.totalDuration / stats.totalDuration) * 100)
              : 0;
            return (
              <div key={sp.name} className="tracking-speaker-item">
                <div
                  className="tracking-speaker-dot"
                  style={{ backgroundColor: SPEAKER_COLORS[i % SPEAKER_COLORS.length] }}
                />
                <span className="tracking-speaker-name">{sp.name}</span>
                <span className="tracking-speaker-time">
                  {formatDuration(sp.totalDuration)} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
