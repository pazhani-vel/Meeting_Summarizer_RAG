"use client";

import { useState } from "react";

import UploadSection from "../components/UploadSection";
import SummarySection from "../components/SummarySection";
import ChatSection from "../components/ChatSection";
import Loading from "../components/Loading";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [videoId, setVideoId] = useState(null);

  return (
    <main
      style={{
        background: "#0F172A",
        minHeight: "100vh",
        padding: "40px",
      }}
    >
      <h1
        style={{
          textAlign: "center",
          color: "#F8FAFC",
          marginBottom: "40px",
        }}
      >
        🎥 Meeting Video RAG Assistant
      </h1>

      <UploadSection
        setLoading={setLoading}
        setSummary={setSummary}
        setVideoId={setVideoId}
      />

      {loading && <Loading />}

      {summary && (
        <>
          <SummarySection summary={summary} />
          <ChatSection videoId={videoId} />
        </>
      )}
    </main>
  );
}