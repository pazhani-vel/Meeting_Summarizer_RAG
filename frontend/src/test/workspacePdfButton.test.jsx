/**
 * Tests for the new "PDF Report" button in the workspace view.
 *
 * The workspace is rendered both on the upload-result page and on meetings
 * loaded from history, so one button covers both.
 *
 * Run:  cd frontend && npx vitest run
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../utils/generateReportPDF", () => ({
  generateMeetingReportPDF: vi.fn(),
}));

import { WorkspaceView } from "../App";
import { generateMeetingReportPDF } from "../utils/generateReportPDF";

function makeProps(overrides = {}) {
  return {
    uploading: false,
    setUploading: vi.fn(),
    summary: {
      summary: "A short meeting summary.",
      key_topics: ["Topic A"],
      action_items: [],
    },
    setSummary: vi.fn(),
    videoId: "m1",
    setVideoId: vi.fn(),
    previewUrl: null,
    setPreviewUrl: vi.fn(),
    videoRef: { current: null },
    transcript: [],
    setTranscript: vi.fn(),
    currentTime: 0,
    setCurrentTime: vi.fn(),
    messages: [
      { sender: "user", text: "What was decided?" },
      { sender: "bot", text: "Ship on Friday." },
    ],
    setMessages: vi.fn(),
    onUploadStart: vi.fn(),
    meetingDetail: {
      meeting: { filename: "standup.mp4", duration_sec: 120, language: "en" },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WorkspaceView — PDF Report button", () => {
  it("shows the button once a result is available (upload page)", () => {
    render(<WorkspaceView {...makeProps()} />);
    expect(
      screen.getByTitle("Download full report as PDF")
    ).toBeInTheDocument();
  });

  it("works for a meeting loaded from history", () => {
    // History load renders the same workspace with meeting detail + chat
    render(<WorkspaceView {...makeProps()} />);
    fireEvent.click(screen.getByTitle("Download full report as PDF"));
    expect(generateMeetingReportPDF).toHaveBeenCalledTimes(1);
    expect(generateMeetingReportPDF).toHaveBeenCalledWith({
      summary: {
        summary: "A short meeting summary.",
        key_topics: ["Topic A"],
        action_items: [],
      },
      messages: [
        { sender: "user", text: "What was decided?" },
        { sender: "bot", text: "Ship on Friday." },
      ],
      filename: "standup.mp4",
    });
  });

  it("hides the button when there is no result yet", () => {
    render(<WorkspaceView {...makeProps({ summary: null, videoId: null })} />);
    expect(
      screen.queryByTitle("Download full report as PDF")
    ).not.toBeInTheDocument();
  });
});
