/**
 * History delete button — icon markup + always-visible styling.
 *
 * The record's delete control must be a trash-icon button on the right side
 * of each history row, and the stylesheet must not hide it (no display:none,
 * visibility:hidden or opacity:0 — computed styles are checked against the
 * real App.css).
 *
 * Run:  cd frontend && npx vitest run
 */

import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import HistoryPanel from "../components/HistoryPanel";

// Vitest stubs CSS imports (test.css defaults to false), so read the real
// stylesheet from disk to verify computed styles against the actual rules.
const css = readFileSync(resolve(process.cwd(), "src", "App.css"), "utf8");

const meetings = [
  {
    meeting_id: "m1",
    filename: "record.mp4",
    status: "ready",
    duration_sec: 60,
    created_at: "2025-06-01T10:00:00Z",
    summary_preview: "A short summary.",
  },
];

function renderPanel(props = {}) {
  return render(
    <HistoryPanel
      open
      meetings={meetings}
      onSelect={vi.fn()}
      onDelete={vi.fn()}
      onNewMeeting={vi.fn()}
      loadingMeeting={false}
      currentMeetingId={null}
      {...props}
    />
  );
}

let styleEl = null;

function injectStylesheet() {
  styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
}

afterEach(() => {
  cleanup();
  if (styleEl) {
    styleEl.remove();
    styleEl = null;
  }
});

describe("HistoryPanel delete button", () => {
  it("renders a trash-icon button on the right side of the record", () => {
    renderPanel();
    const btn = screen.getByTitle("Delete meeting");
    expect(btn).toBeInTheDocument();
    expect(btn.getAttribute("aria-label")).toBe("Delete meeting");
    // Icon inside the button, and the actions column sits at the row's right
    expect(btn.querySelector("svg")).not.toBeNull();
    const actions = btn.closest(".history-item-actions");
    const row = btn.closest(".history-item");
    expect(actions).not.toBeNull();
    expect(row).not.toBeNull();
    expect(row.lastElementChild).toBe(actions);
  });

  it("keeps the two-step confirm flow (icon → Delete? Yes/No → Yes deletes)", () => {
    const onDelete = vi.fn();
    renderPanel({ onDelete });

    fireEvent.click(screen.getByTitle("Delete meeting"));
    expect(screen.getByText("Delete?")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Yes"));
    expect(onDelete).toHaveBeenCalledWith("m1");
  });

  it("No returns to the icon without deleting", () => {
    const onDelete = vi.fn();
    renderPanel({ onDelete });

    fireEvent.click(screen.getByTitle("Delete meeting"));
    fireEvent.click(screen.getByText("No"));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByTitle("Delete meeting")).toBeInTheDocument();
  });

  it("is visible per the real stylesheet (not display:none / hidden / opacity:0)", () => {
    injectStylesheet();
    renderPanel();

    const btn = screen.getByTitle("Delete meeting");
    const actions = btn.closest(".history-item-actions");
    const btnStyle = window.getComputedStyle(btn);
    const actionsStyle = window.getComputedStyle(actions);

    // The button renders as a fixed, bordered icon chip
    expect(btnStyle.display).toBe("inline-flex");
    expect(btnStyle.width).toBe("28px");
    expect(btnStyle.height).toBe("28px");

    // Nothing in the chain may hide it
    expect(btnStyle.visibility).not.toBe("hidden");
    expect(btnStyle.opacity === "" || Number(btnStyle.opacity) > 0).toBe(true);
    expect(actionsStyle.display).toBe("flex");
    expect(actionsStyle.visibility).not.toBe("hidden");
    expect(actionsStyle.opacity === "" || Number(actionsStyle.opacity) > 0).toBe(true);
    expect(actionsStyle.overflow).not.toBe("hidden");
  });
});
