import { useEffect, useRef, useMemo } from "react";

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function speakerClass(speaker) {
  const match = speaker.match(/\d+/);
  if (!match) return "speaker-0";
  return `speaker-${parseInt(match[0], 10) % 8}`;
}

export default function Transcript({ transcript, currentTime, videoRef }) {
  const containerRef = useRef(null);
  const segmentRefs = useRef({});
  const lastActiveRef = useRef(null);

  const activeSegments = useMemo(() => {
    if (!transcript || transcript.length === 0) return new Set();
    const active = new Set();
    for (let i = 0; i < transcript.length; i++) {
      const seg = transcript[i];
      if (seg.start <= currentTime && currentTime < seg.end) {
        active.add(i);
      }
    }
    return active;
  }, [transcript, currentTime]);

  useEffect(() => {
    if (activeSegments.size === 0) return;
    const firstActive = Math.min(...activeSegments);
    if (firstActive === lastActiveRef.current) return;
    lastActiveRef.current = firstActive;

    const el = segmentRefs.current[firstActive];
    if (el && containerRef.current) {
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const isVisible = elRect.top >= containerRect.top && elRect.bottom <= containerRect.bottom;
      if (!isVisible) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [activeSegments]);

  const handleSegmentClick = (startTime) => {
    if (videoRef.current) {
      videoRef.current.currentTime = startTime;
      videoRef.current.play();
    }
  };

  if (!transcript || transcript.length === 0) {
    return (
      <>
        <div className="panel-header">
          <div className="panel-title">
            <span className="panel-eyebrow">Transcript</span>
            <span className="panel-heading">Speaker Transcript</span>
          </div>
        </div>
        <div className="panel-body">
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <div className="empty-state-title">No transcript yet</div>
            <div className="empty-state-sub">Upload a video to generate the transcript.</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="panel-header">
        <div className="panel-title">
          <span className="panel-eyebrow">Transcript</span>
          <span className="panel-heading">Speaker Transcript</span>
        </div>
        <div className="panel-actions">
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {transcript.length} segments
          </span>
        </div>
      </div>
      <div className="panel-body" ref={containerRef}>
        <div className="transcript-list">
          {transcript.map((segment, index) => (
            <div
              key={index}
              ref={(el) => (segmentRefs.current[index] = el)}
              className={`transcript-segment ${activeSegments.has(index) ? "active" : ""}`}
              onClick={() => handleSegmentClick(segment.start)}
            >
              <div className="segment-header">
                <span className={`speaker-label ${speakerClass(segment.speaker)}`}>
                  {segment.speaker}
                </span>
                <span className="segment-time">
                  {formatTime(segment.start)} — {formatTime(segment.end)}
                </span>
              </div>
              {segment.text && (
                <p className="segment-text">{segment.text}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
