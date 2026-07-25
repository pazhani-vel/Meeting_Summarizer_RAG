"use client";

import { useState } from "react";

import { uploadVideo } from "../services/api";

export default function UploadSection({
  setLoading,
  setSummary,
  setVideoId,
}) {
  const [file, setFile] = useState(null);

  const handleUpload = async () => {
    if (!file) {
      alert("Please select a video.");
      return;
    }

    const formData = new FormData();
    formData.append("video", file);

    try {
      setLoading(true);

      const data = await uploadVideo(file);

setSummary(data);
setVideoId(data.video_id);

    } catch (error) {
      console.error(error);
      alert(
        error.response?.data?.message || "Failed to upload video."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="upload-card">
        <h2>Upload Meeting Video</h2>

        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files[0])}
        />

        {file && (
          <p className="filename">
            Selected: <strong>{file.name}</strong>
          </p>
        )}

        <button
          onClick={handleUpload}
          disabled={!file}
        >
          Upload Video
        </button>
      </div>

      <style jsx>{`
        .upload-card {
          width: 100%;
          max-width: 700px;
          margin: 40px auto;
          background: #1e293b;
          padding: 30px;
          border-radius: 15px;
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
          text-align: center;
        }

        h2 {
          color: #06b6d4;
          margin-bottom: 25px;
        }

        input[type="file"] {
          width: 100%;
          color: white;
          padding: 12px;
          border: 2px dashed #7c3aed;
          border-radius: 10px;
          background: #0f172a;
          cursor: pointer;
        }

        input[type="file"]::file-selector-button {
          background: #7c3aed;
          color: white;
          border: none;
          padding: 10px 18px;
          border-radius: 8px;
          cursor: pointer;
          margin-right: 15px;
        }

        .filename {
          margin-top: 20px;
          color: #cbd5e1;
        }

        button {
          margin-top: 25px;
          width: 100%;
          padding: 14px;
          background: #7c3aed;
          color: white;
          font-size: 16px;
          font-weight: bold;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: 0.3s;
        }

        button:hover:not(:disabled) {
          background: #6d28d9;
        }

        button:disabled {
          background: #475569;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .upload-card {
            margin: 20px 10px;
            padding: 20px;
          }
        }
      `}</style>
    </>
  );
}