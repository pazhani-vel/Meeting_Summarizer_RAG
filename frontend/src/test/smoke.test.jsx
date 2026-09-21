/**
 * Frontend smoke tests using Vitest + Testing Library.
 *
 * Covers:
 *   - AuthPage: validation states (empty email, bad email, short password, mismatch)
 *   - HistoryPanel: renders a list of meetings, shows empty state
 *
 * Run:  cd frontend && npx vitest run
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// ── Mock AuthContext so AuthPage doesn't need a real provider ─────────

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    accessToken: null,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: false,
  }),
  AuthProvider: ({ children }) => children,
}));

// ── AuthPage tests ───────────────────────────────────────────────────

import AuthPage from "../pages/AuthPage";

/** Get the submit button (type=submit) — distinct from the tab button. */
function getSubmitButton(name) {
  return screen.getAllByRole("button", { name })[1]; // second match is the submit
}

describe("AuthPage", () => {
  it("renders Sign In and Register tabs", () => {
    render(<AuthPage />);
    expect(screen.getAllByText("Sign In").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Register")).toBeInTheDocument();
  });

  it("shows email error for empty submission", async () => {
    render(<AuthPage />);
    fireEvent.click(getSubmitButton(/sign in/i));
    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
  });

  it("shows email format error for invalid email", async () => {
    render(<AuthPage />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(getSubmitButton(/sign in/i));
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
  });

  it("shows password too short error", async () => {
    render(<AuthPage />);
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "abc" },
    });
    fireEvent.click(getSubmitButton(/sign in/i));
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it("shows confirm password mismatch on register tab", async () => {
    render(<AuthPage />);

    // Switch to register tab
    fireEvent.click(screen.getByRole("button", { name: /register/i }));

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "different123" },
    });

    // The submit button text changes to "Create Account" on register tab
    const submitBtn = screen.getByRole("button", { name: /create account/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it("clears error when switching tabs", async () => {
    render(<AuthPage />);

    // Trigger an error
    fireEvent.click(getSubmitButton(/sign in/i));
    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();

    // Switch to register — error should clear
    fireEvent.click(screen.getByRole("button", { name: /register/i }));
    expect(screen.queryByText(/email is required/i)).not.toBeInTheDocument();
  });
});

// ── HistoryPanel tests ───────────────────────────────────────────────

import HistoryPanel from "../components/HistoryPanel";

describe("HistoryPanel", () => {
  const defaultProps = {
    open: true,
    meetings: [],
    onSelect: vi.fn(),
    onDelete: vi.fn(),
    onNewMeeting: vi.fn(),
    loadingMeeting: false,
    currentMeetingId: null,
  };

  it("renders empty state when no meetings", () => {
    render(<HistoryPanel {...defaultProps} />);
    expect(screen.getByText(/no meetings yet/i)).toBeInTheDocument();
  });

  it("renders a list of meetings", () => {
    const meetings = [
      {
        meeting_id: "m1",
        filename: "meeting_one.mp4",
        status: "ready",
        duration_sec: 120,
        created_at: "2025-06-01T10:00:00Z",
        summary_preview: "A short summary.",
      },
      {
        meeting_id: "m2",
        filename: "meeting_two.mp4",
        status: "failed",
        duration_sec: null,
        created_at: "2025-06-02T10:00:00Z",
      },
    ];

    render(<HistoryPanel {...defaultProps} meetings={meetings} />);

    expect(screen.getByText("meeting_one.mp4")).toBeInTheDocument();
    expect(screen.getByText("meeting_two.mp4")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("shows processing badge for in-progress meetings", () => {
    const meetings = [
      {
        meeting_id: "m3",
        filename: "processing.mp4",
        status: "transcribing",
        duration_sec: null,
        created_at: "2025-06-03T10:00:00Z",
      },
    ];

    render(<HistoryPanel {...defaultProps} meetings={meetings} />);
    expect(screen.getByText("Transcribing")).toBeInTheDocument();
  });

  it("does not render when open is false", () => {
    render(<HistoryPanel {...defaultProps} open={false} />);
    expect(screen.queryByText(/meeting history/i)).not.toBeInTheDocument();
  });

  it("calls onSelect when a meeting is clicked", () => {
    const onSelect = vi.fn();
    const meetings = [
      {
        meeting_id: "m1",
        filename: "test.mp4",
        status: "ready",
        duration_sec: 60,
        created_at: "2025-06-01T10:00:00Z",
      },
    ];

    render(<HistoryPanel {...defaultProps} meetings={meetings} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("test.mp4"));
    expect(onSelect).toHaveBeenCalledWith(meetings[0]);
  });

  it("shows delete confirmation on first click", () => {
    const meetings = [
      {
        meeting_id: "m1",
        filename: "del_test.mp4",
        status: "ready",
        duration_sec: 60,
        created_at: "2025-06-01T10:00:00Z",
      },
    ];

    render(<HistoryPanel {...defaultProps} meetings={meetings} />);

    // Click the × button
    fireEvent.click(screen.getByTitle("Delete meeting"));
    expect(screen.getByText("Delete?")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("calls onDelete on confirmed delete", () => {
    const onDelete = vi.fn();
    const meetings = [
      {
        meeting_id: "m1",
        filename: "del_test.mp4",
        status: "ready",
        duration_sec: 60,
        created_at: "2025-06-01T10:00:00Z",
      },
    ];

    render(<HistoryPanel {...defaultProps} meetings={meetings} onDelete={onDelete} />);

    // First click → confirmation
    fireEvent.click(screen.getByTitle("Delete meeting"));
    // Second click → confirm
    fireEvent.click(screen.getByText("Yes"));
    expect(onDelete).toHaveBeenCalledWith("m1");
  });
});
