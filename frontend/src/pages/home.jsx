// "use client";

// import { useState } from "react";

// import UploadSection from "../components/UploadSection";
// import SummarySection from "../components/SummarySection";
// import ChatSection from "../components/ChatSection";
// import Loading from "../components/Loading";

// export default function Home() {
//   const [loading, setLoading] = useState(false);
//   const [summary, setSummary] = useState(null);
//   const [videoId, setVideoId] = useState(null);

//   return (
//     <main
//       style={{
//         background: "#0F172A",
//         minHeight: "100vh",
//         padding: "40px",
//       }}
//     >
//       <h1
//         style={{
//           textAlign: "center",
//           color: "#F8FAFC",
//           marginBottom: "40px",
//         }}
//       >
//         🎥 Meeting Video RAG Assistant
//       </h1>

//       <UploadSection
//         setLoading={setLoading}
//         setSummary={setSummary}
//         setVideoId={setVideoId}
//       />

//       {loading && <Loading />}

//       {summary && (
//         <>
//           <SummarySection summary={summary} />
//           <ChatSection videoId={videoId} />
//         </>
//       )}
//     </main>
//   );
// }

"use client";

import { useState } from "react";

import UploadSection from "../components/UploadSection";
import SummarySection from "../components/SummarySection";
import ChatSection from "../components/ChatSection";

export default function Home() {
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [videoId, setVideoId] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const ready = Boolean(videoId);
  const status = uploading ? "processing" : ready ? "ready" : "idle";

  return (
    <>
      <main className="stage">
        <header className="masthead">
          <div className="mark">
            <span className="mark-dot" data-status={status} />
            <h1>Meeting Video RAG Assistant</h1>
          </div>
          <p className="eyebrow">
            INGEST · TRANSCRIBE · ASK — turn a recording into an answerable
            conversation
          </p>
        </header>

        <div className="console">
          <section className="pane pane-intake">
            <UploadSection
              uploading={uploading}
              setUploading={setUploading}
              setSummary={setSummary}
              setVideoId={setVideoId}
              previewUrl={previewUrl}
              setPreviewUrl={setPreviewUrl}
            />
            {summary && <SummarySection summary={summary} />}
          </section>

          <div className="waveform-divider" data-status={status} aria-hidden="true">
            {Array.from({ length: 14 }).map((_, i) => (
              <span key={i} style={{ animationDelay: `${i * 0.07}s` }} />
            ))}
          </div>

          <section className="pane pane-chat">
            <ChatSection videoId={videoId} status={status} />
          </section>
        </div>
      </main>

      <style jsx global>{`
        :root {
          --bg-base: #0b1220;
          --bg-panel: #131b2e;
          --bg-panel-alt: #0f1626;
          --accent-cyan: #22d3ee;
          --accent-violet: #8b5cf6;
          --accent-green: #34d399;
          --accent-amber: #fbbf24;
          --text-primary: #f1f5f9;
          --text-muted: #8b98af;
          --border-soft: rgba(255, 255, 255, 0.08);
          --font-display: "Sora", "Segoe UI", system-ui, sans-serif;
          --font-body: "Inter", "Segoe UI", system-ui, sans-serif;
          --font-mono: "IBM Plex Mono", "SFMono-Regular", Menlo, monospace;
        }

        @import url("https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap");

        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: var(--bg-base);
          color: var(--text-primary);
          font-family: var(--font-body);
        }
      `}</style>

      <style jsx>{`
        .stage {
          min-height: 100vh;
          padding: 36px 40px 60px;
          background: radial-gradient(
              1100px 500px at 12% -10%,
              rgba(139, 92, 246, 0.16),
              transparent 60%
            ),
            radial-gradient(
              900px 500px at 100% 0%,
              rgba(34, 211, 238, 0.12),
              transparent 55%
            ),
            var(--bg-base);
        }

        .masthead {
          max-width: 1320px;
          margin: 0 auto 30px;
        }

        .mark {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .mark-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--text-muted);
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.05);
          flex-shrink: 0;
        }

        .mark-dot[data-status="ready"] {
          background: var(--accent-green);
          box-shadow: 0 0 0 4px rgba(52, 211, 153, 0.18);
        }

        .mark-dot[data-status="processing"] {
          background: var(--accent-amber);
          box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.18);
          animation: pulse 1.1s ease-in-out infinite;
        }

        h1 {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 26px;
          letter-spacing: -0.01em;
          margin: 0;
        }

        .eyebrow {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--text-muted);
          margin: 10px 0 0 22px;
        }

        .console {
          max-width: 1320px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 0.86fr) auto minmax(0, 1.14fr);
          align-items: stretch;
          gap: 26px;
        }

        .pane {
          min-width: 0;
        }

        .pane-intake {
          display: flex;
          flex-direction: column;
          gap: 22px;
        }

        .pane-chat {
          display: flex;
          min-height: 640px;
        }

        .waveform-divider {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 4px;
          width: 18px;
        }

        .waveform-divider span {
          width: 3px;
          height: 14px;
          border-radius: 2px;
          background: var(--border-soft);
        }

        .waveform-divider[data-status="ready"] span {
          background: linear-gradient(
            180deg,
            var(--accent-cyan),
            var(--accent-violet)
          );
        }

        .waveform-divider[data-status="processing"] span {
          background: var(--accent-amber);
          animation: bounce 0.9s ease-in-out infinite;
        }

        @keyframes bounce {
          0%,
          100% {
            height: 6px;
            opacity: 0.5;
          }
          50% {
            height: 22px;
            opacity: 1;
          }
        }

        @keyframes pulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.35);
          }
        }

        @media (max-width: 980px) {
          .stage {
            padding: 24px 16px 40px;
          }

          .console {
            grid-template-columns: 1fr;
          }

          .waveform-divider {
            flex-direction: row;
            width: 100%;
            height: 18px;
            padding: 4px 0;
          }

          .waveform-divider span {
            width: 14px;
            height: 3px;
          }

          .waveform-divider[data-status="processing"] span {
            animation: bounce-h 0.9s ease-in-out infinite;
          }

          @keyframes bounce-h {
            0%,
            100% {
              width: 6px;
              opacity: 0.5;
            }
            50% {
              width: 22px;
              opacity: 1;
            }
          }

          .pane-chat {
            min-height: 520px;
          }

          .eyebrow {
            margin-left: 0;
          }
        }
      `}</style>
    </>
  );
}