import { useRef, useState, useCallback, useEffect } from "react";

import "./App.css";

import { AuthProvider, useAuth } from "./context/AuthContext";
import AuthPage from "./pages/AuthPage";
import Navbar from "./components/Navbar";
import HistoryPanel from "./components/HistoryPanel";
import VideoPanel from "./components/VideoPanel";
import Transcript from "./components/Transcript";
import SummaryPanel from "./components/SummaryPanel";
import ChatPanel from "./components/ChatPanel";
import TrackingPanel from "./components/TrackingPanel";

import {
  getMeetings,
  getMeeting,
  deleteMeeting,
  getTranscript,
  getChatMessages,
  getVideoBlob,
} from "./services/api";

// ═══════════════════════════════════════════════════════════
// SVG Icons (inline for zero deps)
// ═══════════════════════════════════════════════════════════

const Icons = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
    </svg>
  ),
  upload: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  transcript: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  summary: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  check: <span style={{ color: "var(--red)" }}>✓</span>,
};

// ═══════════════════════════════════════════════════════════
// Landing View (hero + features)
// ═══════════════════════════════════════════════════════════

function LandingView({ onNavigateToUpload }) {
  return (
    <div className="main-scroll">
      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">AI-Powered</div>
          <h1 className="hero-title">
            Turn Meetings into<br />
            <span className="accent">Searchable Intelligence</span>
          </h1>
          <p className="hero-subtitle">
            Upload a meeting video and extract speaker information, full transcript,
            AI-generated summaries, and a searchable knowledge base you can chat with.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={onNavigateToUpload}>
              {Icons.upload} Upload Meeting Video
            </button>
          </div>
          <div className="hero-features">
            <div className="hero-feature">{Icons.check} Speaker Detection</div>
            <div className="hero-feature">{Icons.check} Full Transcript</div>
            <div className="hero-feature">{Icons.check} AI Summary</div>
            <div className="hero-feature">{Icons.check} RAG Chatbot</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="feature-section">
        <div className="feature-section-title">Capabilities</div>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-card-icon">🎥</div>
            <div className="feature-card-title">Video Upload</div>
            <div className="feature-card-desc">
              Drag and drop or browse to upload meeting recordings.
              Supports MP4, WebM, MOV, MKV, and AVI formats.
            </div>
            <div className="feature-card-status"><span className="dot" /> Ready to upload</div>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">👥</div>
            <div className="feature-card-title">Speaker Intelligence</div>
            <div className="feature-card-desc">
              Automatic speaker detection and attribution using
              SpeechBrain ECAPA embeddings with hierarchical clustering.
            </div>
            <div className="feature-card-status"><span className="dot" /> Powered by SpeechBrain</div>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">📝</div>
            <div className="feature-card-title">AI Transcript</div>
            <div className="feature-card-desc">
              Full meeting transcript with timestamps, speaker labels,
              and click-to-seek video navigation.
            </div>
            <div className="feature-card-status"><span className="dot" /> Powered by Whisper</div>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">📊</div>
            <div className="feature-card-title">Smart Summary</div>
            <div className="feature-card-desc">
              AI-generated meeting summary with key topics, action items,
              and decisions. Downloadable as PDF.
            </div>
            <div className="feature-card-status"><span className="dot" /> Powered by Groq LLM</div>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">💬</div>
            <div className="feature-card-title">Meeting Chatbot</div>
            <div className="feature-card-desc">
              Ask questions about your meeting and get contextual answers
              from the transcript using RAG retrieval.
            </div>
            <div className="feature-card-status"><span className="dot" /> Powered by ChromaDB + RAG</div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Workspace View (video + panels)
// ═══════════════════════════════════════════════════════════

function WorkspaceView({
  uploading,
  setUploading,
  summary,
  setSummary,
  videoId,
  setVideoId,
  previewUrl,
  setPreviewUrl,
  videoRef,
  transcript,
  setTranscript,
  currentTime,
  setCurrentTime,
  messages,
  setMessages,
  onUploadStart,
  meetingDetail,
}) {
  const duration = meetingDetail?.meeting?.duration_sec;
  const language = meetingDetail?.meeting?.language;

  return (
    <div className="workspace">
      <div className="workspace-top">
        {/* Video Player */}
        <div className="workspace-video">
          <VideoPanel
            uploading={uploading}
            setUploading={setUploading}
            setSummary={setSummary}
            setVideoId={setVideoId}
            setTranscript={setTranscript}
            previewUrl={previewUrl}
            setPreviewUrl={setPreviewUrl}
            videoRef={videoRef}
            setCurrentTime={setCurrentTime}
            onUploadStart={onUploadStart}
          />
        </div>

        {/* Meeting Info Sidebar */}
        <div className="workspace-info">
          <div className="info-section" style={{ flex: "0 0 auto" }}>
            <div className="panel-header" style={{ padding: "12px 16px", background: "var(--bg-secondary)" }}>
              <div className="panel-title">
                <span className="panel-eyebrow">Meeting</span>
                <span className="panel-heading">Details</span>
              </div>
            </div>
          </div>
          <div className="info-section">
            <div className="info-label">Status</div>
            <StatusBadge
              status={uploading ? "processing" : videoId ? "ready" : "idle"}
            />
          </div>
          {meetingDetail?.meeting && (
            <>
              <div className="info-section">
                <div className="info-label">File</div>
                <div className="info-value" style={{ fontSize: 12, wordBreak: "break-all" }}>
                  {meetingDetail.meeting.filename}
                </div>
              </div>
              <div className="info-section">
                <div className="info-grid">
                  {duration != null && (
                    <div className="info-item">
                      <div className="info-label">Duration</div>
                      <div className="info-value">{formatDuration(duration)}</div>
                    </div>
                  )}
                  {language && (
                    <div className="info-item">
                      <div className="info-label">Language</div>
                      <div className="info-value">{language.toUpperCase()}</div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          {transcript.length > 0 && (
            <div className="info-section">
              <div className="info-label">Speakers</div>
              <div className="info-value">{countSpeakers(transcript)}</div>
            </div>
          )}
          {transcript.length > 0 && (
            <div className="info-section">
              <div className="info-label">Segments</div>
              <div className="info-value">{transcript.length}</div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Panels */}
      <div className="workspace-panels">
        <div className="workspace-panel">
          <SummaryPanel summary={summary} messages={messages} />
        </div>
        <div className="workspace-panel">
          <Transcript transcript={transcript} currentTime={currentTime} videoRef={videoRef} />
        </div>
        <div className="workspace-panel">
          <TrackingPanel transcript={transcript} />
        </div>
        <div className="workspace-panel">
          <ChatPanel videoId={videoId} status={uploading ? "processing" : videoId ? "ready" : "idle"} messages={messages} setMessages={setMessages} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

function StatusBadge({ status }) {
  const map = {
    idle: { label: "No video", cls: "pending" },
    processing: { label: "Processing…", cls: "processing" },
    ready: { label: "Ready", cls: "ready" },
  };
  const cfg = map[status] || map.idle;
  return (
    <span className={`status-badge ${cfg.cls}`}>
      {cfg.cls === "processing" && <span className="status-spinner" />}
      {cfg.label}
    </span>
  );
}

function formatDuration(sec) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function countSpeakers(transcript) {
  const speakers = new Set(transcript.map((s) => s.speaker));
  return speakers.size;
}

// ═══════════════════════════════════════════════════════════
// Dashboard (main orchestrator)
// ═══════════════════════════════════════════════════════════

function Dashboard() {
  const { user, logout } = useAuth();

  // View
  const [currentView, setCurrentView] = useState("landing"); // "landing" | "workspace"

  // History
  const [meetings, setMeetings] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadingMeeting, setLoadingMeeting] = useState(false);

  // Meeting state
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [videoId, setVideoId] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [messages, setMessages] = useState([]);
  const [currentMeetingId, setCurrentMeetingId] = useState(null);
  const [meetingDetail, setMeetingDetail] = useState(null);

  const videoRef = useRef(null);

  // ── Derived status ──
  const ready = Boolean(videoId);
  const status = uploading ? "processing" : ready ? "ready" : "idle";

  // ── Clear meeting state (for new meeting / logout) ──
  const clearMeetingState = useCallback(() => {
    setSummary(null);
    setVideoId(null);
    setTranscript([]);
    setMessages([]);
    setCurrentMeetingId(null);
    setCurrentTime(0);
    setMeetingDetail(null);
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
  }, [previewUrl]);

  // ── Load meetings on login ──
  useEffect(() => {
    if (!user) return;
    getMeetings()
      .then((data) => {
        if (data.status === "success") setMeetings(data.meetings);
      })
      .catch(() => {});
  }, [user]);

  // ── Fetch video blob ──
  const fetchVideoBlob = useCallback(
    async (meetingId) => getVideoBlob(meetingId),
    [],
  );

  // ── Load meeting from history ──
  const handleLoadMeeting = async (meeting) => {
    setLoadingMeeting(true);
    try {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }

      const [meetingData, transcriptData, chatData] = await Promise.all([
        getMeeting(meeting.meeting_id),
        getTranscript(meeting.meeting_id).catch(() => ({ segments: [] })),
        getChatMessages(meeting.meeting_id).catch(() => ({ messages: [] })),
      ]);

      if (meetingData.status !== "success") return;

      const m = meetingData.meeting;
      setCurrentMeetingId(m.meeting_id);
      setVideoId(m.meeting_id);
      setMeetingDetail(meetingData);

      // Normalize summary: MongoDB stores the dict inside the "summary" field,
      // so meetingData.summary.summary may be a nested object instead of a string.
      const rawSummary = meetingData.summary;
      if (rawSummary && typeof rawSummary.summary === "object" && rawSummary.summary !== null) {
        setSummary({
          summary: rawSummary.summary.summary || "",
          key_topics: rawSummary.key_topics || rawSummary.summary.key_topics || [],
          action_items: rawSummary.action_items || rawSummary.summary.action_items || [],
        });
      } else {
        setSummary(rawSummary);
      }
      // Normalize segments: MongoDB uses start_sec/end_sec, but components expect start/end
      const segments = (transcriptData.segments || []).map((seg) => ({
        start: seg.start ?? seg.start_sec ?? 0,
        end: seg.end ?? seg.end_sec ?? 0,
        speaker: seg.speaker || "UNKNOWN",
        text: seg.text || "",
      }));
      setTranscript(segments);
      setMessages(
        (chatData.messages || []).map((msg) => ({
          sender: msg.role === "assistant" ? "bot" : msg.role,
          text: msg.content,
          sources: msg.sources || [],
        })),
      );
      setCurrentTime(0);
      setCurrentView("workspace");

      try {
        const blobUrl = await fetchVideoBlob(m.meeting_id);
        setPreviewUrl(blobUrl);
      } catch {
        setPreviewUrl(null);
      }
    } catch (err) {
      console.error("Failed to load meeting:", err);
    } finally {
      setLoadingMeeting(false);
    }
  };

  // ── Delete meeting ──
  const handleDeleteMeeting = async (meetingId) => {
    try {
      await deleteMeeting(meetingId);
      setMeetings((prev) => prev.filter((m) => m.meeting_id !== meetingId));
      if (currentMeetingId === meetingId) {
        clearMeetingState();
        setCurrentView("landing");
      }
    } catch (err) {
      console.error("Failed to delete meeting:", err);
    }
  };

  // ── New meeting ──
  const handleNewMeeting = () => {
    clearMeetingState();
    setCurrentView("landing");
  };

  // ── Upload start ──
  const handleUploadStart = useCallback(() => {
    setSummary(null);
    setTranscript([]);
    setMessages([]);
    setCurrentMeetingId(null);
    setCurrentTime(0);
    setMeetingDetail(null);
    setUploading(true);
  }, []);

  // ── Navigate to upload (from hero CTA) ──
  const handleNavigateToUpload = () => {
    // If a meeting is already loaded, clear it first
    if (videoId) {
      clearMeetingState();
    }
    setCurrentView("workspace");
  };

  // ── Watch for upload completion → fetch meeting detail + switch to workspace ──
  useEffect(() => {
    if (videoId && !currentMeetingId) {
      setCurrentView("workspace");
      getMeeting(videoId)
        .then((data) => {
          if (data.status === "success") setMeetingDetail(data);
        })
        .catch(() => {});
    }
  }, [videoId, currentMeetingId]);

  // ── Refresh meetings after upload ──
  useEffect(() => {
    if (videoId && user && !currentMeetingId) {
      getMeetings()
        .then((data) => {
          if (data.status === "success") setMeetings(data.meetings);
        })
        .catch(() => {});
    }
  }, [videoId, user, currentMeetingId]);

  // ── Logout ──
  const handleLogout = async () => {
    clearMeetingState();
    setCurrentView("landing");
    await logout();
  };

  // ── Remove video ──
  const handleRemoveVideo = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSummary(null);
    setVideoId(null);
    setTranscript([]);
    setCurrentTime(0);
    setMessages([]);
    setCurrentMeetingId(null);
    setMeetingDetail(null);
  };

  return (
    <div className="app">
      <Navbar
        status={status}
        user={user}
        onLogout={handleLogout}
        currentView={currentView}
        onNavigate={setCurrentView}
        historyOpen={historyOpen}
        setHistoryOpen={setHistoryOpen}
      />

      <HistoryPanel
        open={historyOpen}
        meetings={meetings}
        onSelect={handleLoadMeeting}
        onDelete={handleDeleteMeeting}
        onNewMeeting={handleNewMeeting}
        loadingMeeting={loadingMeeting}
        currentMeetingId={currentMeetingId}
      />

      {currentView === "landing" ? (
        <LandingView onNavigateToUpload={handleNavigateToUpload} />
      ) : (
        <WorkspaceView
          uploading={uploading}
          setUploading={setUploading}
          summary={summary}
          setSummary={setSummary}
          videoId={videoId}
          setVideoId={setVideoId}
          previewUrl={previewUrl}
          setPreviewUrl={setPreviewUrl}
          videoRef={videoRef}
          transcript={transcript}
          setTranscript={setTranscript}
          currentTime={currentTime}
          setCurrentTime={setCurrentTime}
          messages={messages}
          setMessages={setMessages}
          currentMeetingId={currentMeetingId}
          onUploadStart={handleUploadStart}
          onRemoveVideo={handleRemoveVideo}
          meetingDetail={meetingDetail}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Root
// ═══════════════════════════════════════════════════════════

function AppInner() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="app">
        <div className="login-page">
          <div className="login-card" style={{ textAlign: "center" }}>
            <div className="navbar-logo" style={{ margin: "0 auto 14px", width: 12, height: 12 }} />
            <p style={{ color: "var(--text-muted)", marginTop: 12 }}>Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <AuthPage />;

  return <Dashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
