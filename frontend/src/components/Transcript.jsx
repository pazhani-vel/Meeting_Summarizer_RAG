import { useEffect, useRef, useMemo } from "react";

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

// Map speaker ID to a color class index
function speakerClass(speaker) {
  const match = speaker.match(/\d+/);
  if (!match) return "speaker-0";
  const num = parseInt(match[0], 10);
  return `speaker-${num % 8}`;
}

export default function Transcript({ transcript, currentTime, videoRef }) {
  const containerRef = useRef(null);
  const segmentRefs = useRef({});
  const lastActiveRef = useRef(null);

  // Find active segments
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

  // Auto-scroll when active segment changes
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
      const isVisible =
        elRect.top >= containerRect.top &&
        elRect.bottom <= containerRect.bottom;

      if (!isVisible) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [activeSegments]);

  // Click to seek
  const handleSegmentClick = (startTime) => {
    if (videoRef.current) {
      videoRef.current.currentTime = startTime;
      videoRef.current.play();
    }
  };

  if (!transcript || transcript.length === 0) {
    return (
      <div className="panel transcript-panel">
        <div className="panel-header">
          <div className="panel-title">
            <span className="panel-eyebrow">03 · Transcript</span>
            <span className="panel-heading">Speaker transcript</span>
          </div>
        </div>
        <div className="panel-body">
          <div className="empty-state">
            Upload and process a meeting video to see the transcript.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel transcript-panel">
      <div className="panel-header">
        <div className="panel-title">
          <span className="panel-eyebrow">03 · Transcript</span>
          <span className="panel-heading">Speaker transcript</span>
        </div>
      </div>
      <div className="panel-body" ref={containerRef}>
        <div className="transcript-list">
          {transcript.map((segment, index) => (
            <div
              key={index}
              ref={(el) => (segmentRefs.current[index] = el)}
              className={`transcript-segment ${
                activeSegments.has(index) ? "active" : ""
              }`}
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
    </div>
  );
}
