import { useRef, useState } from "react";

import { uploadVideo } from "../services/api";

const PROCESSING_STEPS = [
  "Extracting audio",
  "Transcribing",
  "Detecting speakers",
  "Creating transcript",
  "Generating summary",
  "Indexing for RAG",
];

export default function VideoPanel({
  uploading,
  setUploading,
  setSummary,
  setVideoId,
  setTranscript,
  previewUrl,
  setPreviewUrl,
  videoRef,
  setCurrentTime,
}) {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
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
    setTranscript([]);
    setCurrentTime(0);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploading(true);
      setError(null);
      setActiveStep(0);

      // Simulate step progression
      const stepInterval = setInterval(() => {
        setActiveStep((prev) => {
          if (prev >= PROCESSING_STEPS.length - 1) return prev;
          return prev + 1;
        });
      }, 3000);

      const data = await uploadVideo(file);

      clearInterval(stepInterval);

      setSummary(data);
      setVideoId(data.video_id);
      if (data.diarization) {
        setTranscript(data.diarization);
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message ||
          "Unable to process this video. Please try again."
      );
    } finally {
      setUploading(false);
      setActiveStep(0);
    }
  };

  const handleRemove = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
    setFile(null);
    setPreviewUrl(null);
    setSummary(null);
    setVideoId(null);
    setTranscript([]);
    setCurrentTime(0);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  return (
    <div className="panel video-panel">
      <div className="panel-header">
        <div className="panel-title">
          <span className="panel-eyebrow">01 · Video</span>
          <span className="panel-heading">Meeting recording</span>
        </div>
      </div>

      {!previewUrl && (
        <>
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
              accept="video/mp4,video/webm,video/quicktime,video/x-matroska,video/x-msvideo"
              onChange={(e) => pickFile(e.target.files?.[0])}
              hidden
            />
            <div className="dropzone-icon">🎥</div>
            <p className="dropzone-title">Drag & drop your video here</p>
            <p className="dropzone-sub">
              or <span>browse files</span>
            </p>
            <p className="dropzone-sub">MP4, WebM, MOV, MKV, AVI</p>
          </label>
        </>
      )}

      {previewUrl && (
        <div className="video-area">
          <div className="video-player-container">
            <video
              ref={videoRef}
              src={previewUrl}
              controls
              onTimeUpdate={handleTimeUpdate}
            />
          </div>
          <div className="video-controls">
            <div className="video-file-info">
              <span
                className="dot"
                data-state={uploading ? "busy" : "ready"}
              />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file?.name}
              </span>
            </div>
            {!uploading && (
              <button className="remove-btn" onClick={handleRemove}>
                Remove Video
              </button>
            )}
          </div>
        </div>
      )}

      {uploading && (
        <div className="processing-steps">
          {PROCESSING_STEPS.map((step, i) => (
            <div
              key={step}
              className={`processing-step ${
                i < activeStep ? "done" : i === activeStep ? "active" : ""
              }`}
            >
              <span className="step-icon">
                {i < activeStep ? "✓" : i === activeStep ? "⟳" : ""}
              </span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      )}

      {previewUrl && (
        <button
          className="upload-btn"
          onClick={handleUpload}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <span className="spinner" /> Processing...
            </>
          ) : (
            "Analyze this video"
          )}
        </button>
      )}

      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
