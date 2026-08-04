// "use client";

// import { useState } from "react";

// import { uploadVideo } from "../services/api";

// export default function UploadSection({
//   setLoading,
//   setSummary,
//   setVideoId,
// }) {
//   const [file, setFile] = useState(null);

//   const handleUpload = async () => {
//     if (!file) {
//       alert("Please select a video.");
//       return;
//     }

//     const formData = new FormData();
//     formData.append("video", file);

//     try {
//       setLoading(true);

//       const data = await uploadVideo(file);

// setSummary(data);
// setVideoId(data.video_id);

//     } catch (error) {
//       console.error(error);
//       alert(
//         error.response?.data?.message || "Failed to upload video."
//       );
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <>
//       <div className="upload-card">
//         <h2>Upload Meeting Video</h2>

//         <input
//           type="file"
//           accept="video/*"
//           onChange={(e) => setFile(e.target.files[0])}
//         />

//         {file && (
//           <p className="filename">
//             Selected: <strong>{file.name}</strong>
//           </p>
//         )}

//         <button
//           onClick={handleUpload}
//           disabled={!file}
//         >
//           Upload Video
//         </button>
//       </div>

//       <style jsx>{`
//         .upload-card {
//           width: 100%;
//           max-width: 700px;
//           margin: 40px auto;
//           background: #1e293b;
//           padding: 30px;
//           border-radius: 15px;
//           box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
//           text-align: center;
//         }

//         h2 {
//           color: #06b6d4;
//           margin-bottom: 25px;
//         }

//         input[type="file"] {
//           width: 100%;
//           color: white;
//           padding: 12px;
//           border: 2px dashed #7c3aed;
//           border-radius: 10px;
//           background: #0f172a;
//           cursor: pointer;
//         }

//         input[type="file"]::file-selector-button {
//           background: #7c3aed;
//           color: white;
//           border: none;
//           padding: 10px 18px;
//           border-radius: 8px;
//           cursor: pointer;
//           margin-right: 15px;
//         }

//         .filename {
//           margin-top: 20px;
//           color: #cbd5e1;
//         }

//         button {
//           margin-top: 25px;
//           width: 100%;
//           padding: 14px;
//           background: #7c3aed;
//           color: white;
//           font-size: 16px;
//           font-weight: bold;
//           border: none;
//           border-radius: 10px;
//           cursor: pointer;
//           transition: 0.3s;
//         }

//         button:hover:not(:disabled) {
//           background: #6d28d9;
//         }

//         button:disabled {
//           background: #475569;
//           cursor: not-allowed;
//         }

//         @media (max-width: 768px) {
//           .upload-card {
//             margin: 20px 10px;
//             padding: 20px;
//           }
//         }
//       `}</style>
//     </>
//   );
// }


"use client";

import { useRef, useState } from "react";

import { uploadVideo } from "../services/api";

export default function UploadSection({
  uploading,
  setUploading,
  setSummary,
  setVideoId,
  previewUrl,
  setPreviewUrl,
}) {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const pickFile = (selected) => {
    if (!selected) return;
    if (!selected.type.startsWith("video/")) {
      setError("That file isn't a video. Choose an mp4, mov, or webm file.");
      return;
    }
    setError(null);
    setFile(selected);
    setSummary(null);
    setVideoId(null);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploading(true);
      setError(null);

      const data = await uploadVideo(file);

      setSummary(data);
      setVideoId(data.video_id);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message || "Failed to process this video. Try again."
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="intake-card">
        <div className="card-head">
          <span className="eyebrow">01 · Ingest</span>
          <h2>Meeting recording</h2>
        </div>

        {!previewUrl && (
          <label
            className={`dropzone ${dragActive ? "active" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              pickFile(e.dataTransfer.files?.[0]);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="video/*"
              onChange={(e) => pickFile(e.target.files?.[0])}
              hidden
            />
            <div className="dropzone-icon">▲</div>
            <p className="dropzone-title">Drop a video, or click to browse</p>
            <p className="dropzone-sub">MP4, MOV, or WEBM</p>
          </label>
        )}

        {previewUrl && (
          <div className="preview-wrap">
            <video src={previewUrl} controls className="preview-video" />
            <div className="preview-meta">
              <div className="filename">
                <span className="dot" data-state={videoIdState(uploading)} />
                {file?.name}
              </div>
              {!uploading && (
                <button
                  className="ghost-btn"
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl(null);
                    setSummary(null);
                    setVideoId(null);
                    setError(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                >
                  Change video
                </button>
              )}
            </div>
          </div>
        )}

        {error && <p className="error-text">{error}</p>}

        {previewUrl && (
          <button
            className="primary-btn"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <span className="spinner" /> Transcribing &amp; summarizing…
              </>
            ) : (
              "Analyze this video"
            )}
          </button>
        )}
      </div>

      <style jsx>{`
        .intake-card {
          background: var(--bg-panel);
          border: 1px solid var(--border-soft);
          border-radius: 16px;
          padding: 22px;
        }

        .card-head {
          margin-bottom: 16px;
        }

        .eyebrow {
          display: block;
          font-family: var(--font-mono);
          font-size: 10.5px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--accent-violet);
          margin-bottom: 6px;
        }

        h2 {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 600;
          margin: 0;
        }

        .dropzone {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 44px 20px;
          border: 1.5px dashed var(--border-soft);
          border-radius: 12px;
          background: var(--bg-panel-alt);
          cursor: pointer;
          transition: border-color 0.2s ease, background 0.2s ease;
        }

        .dropzone.active,
        .dropzone:hover {
          border-color: var(--accent-cyan);
          background: rgba(34, 211, 238, 0.05);
        }

        .dropzone-icon {
          color: var(--accent-cyan);
          font-size: 15px;
          margin-bottom: 4px;
        }

        .dropzone-title {
          margin: 0;
          font-weight: 500;
          color: var(--text-primary);
          font-size: 14.5px;
        }

        .dropzone-sub {
          margin: 0;
          color: var(--text-muted);
          font-size: 12.5px;
        }

        .preview-wrap {
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--border-soft);
        }

        .preview-video {
          width: 100%;
          max-height: 260px;
          display: block;
          background: #000;
        }

        .preview-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 12px;
          background: var(--bg-panel-alt);
        }

        .filename {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--accent-green);
          flex-shrink: 0;
        }

        .dot[data-state="busy"] {
          background: var(--accent-amber);
          animation: blink 1s ease-in-out infinite;
        }

        @keyframes blink {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.35;
          }
        }

        .ghost-btn {
          background: transparent;
          border: 1px solid var(--border-soft);
          color: var(--text-muted);
          font-size: 12px;
          padding: 6px 10px;
          border-radius: 8px;
          cursor: pointer;
          flex-shrink: 0;
        }

        .ghost-btn:hover {
          color: var(--text-primary);
          border-color: var(--accent-cyan);
        }

        .primary-btn {
          margin-top: 16px;
          width: 100%;
          padding: 13px;
          border: none;
          border-radius: 10px;
          background: linear-gradient(
            90deg,
            var(--accent-violet),
            var(--accent-cyan)
          );
          color: #06101f;
          font-weight: 600;
          font-size: 14.5px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: opacity 0.2s ease, transform 0.1s ease;
        }

        .primary-btn:hover:not(:disabled) {
          opacity: 0.92;
        }

        .primary-btn:active:not(:disabled) {
          transform: scale(0.99);
        }

        .primary-btn:disabled {
          cursor: default;
          opacity: 0.85;
        }

        .spinner {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid rgba(6, 16, 31, 0.35);
          border-top-color: #06101f;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .error-text {
          margin: 12px 0 0;
          color: #fca5a5;
          font-size: 13px;
        }
      `}</style>
    </>
  );
}

function videoIdState(uploading) {
  return uploading ? "busy" : "ready";
}