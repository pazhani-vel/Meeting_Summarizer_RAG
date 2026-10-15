/**
 * Tests for the full meeting report PDF generator.
 *
 * Covers:
 *   - Each section starts on its own page (separate pages for
 *     summary / important / tasks / chat)
 *   - Tasks page only appears when tasks were given
 *   - Chat page only appears when a chat exists
 *   - Long content continues on extra pages without losing section starts
 *   - Nested summary documents (MongoDB shape) are normalised
 *   - Report file name derivation
 *
 * Run:  cd frontend && npx vitest run
 */

import { describe, it, expect } from "vitest";
import {
  buildMeetingReportPDF,
  getReportFileName,
} from "../utils/generateReportPDF";

const fullSummary = {
  summary: "We discussed the roadmap, reviewed last sprint, and planned next steps.",
  key_topics: ["Roadmap planning", "Sprint review", "Hiring"],
  action_items: ["Publish the roadmap", "Schedule interviews"],
};

describe("buildMeetingReportPDF", () => {
  it("puts every section on its own page", () => {
    const { doc, sections } = buildMeetingReportPDF({
      summary: fullSummary,
      messages: [
        { sender: "user", text: "What did we decide?" },
        { sender: "bot", text: "We decided to ship on Friday." },
      ],
      filename: "standup.mp4",
    });

    expect(sections.map((s) => s.title)).toEqual([
      "Summary",
      "Important in This Video",
      "Tasks / Action Items",
      "Chat: Questions & Answers",
    ]);

    // Each section starts on a distinct page, in order
    const pages = sections.map((s) => s.page);
    expect(new Set(pages).size).toBe(pages.length);
    expect([...pages].sort((a, b) => a - b)).toEqual(pages);

    // One page per section minimum
    expect(doc.internal.getNumberOfPages()).toBeGreaterThanOrEqual(4);
  });

  it("omits the tasks page when no task was given", () => {
    const { sections } = buildMeetingReportPDF({
      summary: { ...fullSummary, action_items: [] },
      messages: [],
    });
    expect(sections.map((s) => s.title)).toEqual([
      "Summary",
      "Important in This Video",
    ]);
  });

  it("omits the chat page when there is no chat", () => {
    const { sections } = buildMeetingReportPDF({
      summary: fullSummary,
      messages: [],
    });
    expect(sections.map((s) => s.title)).not.toContain(
      "Chat: Questions & Answers"
    );
  });

  it("continues long content on extra pages without duplicating sections", () => {
    const longSummary = {
      summary: Array.from({ length: 200 }, (_, i) => `Sentence ${i} of the very long meeting summary.`).join(" "),
      key_topics: [],
      action_items: [],
    };

    const { doc, sections } = buildMeetingReportPDF({
      summary: longSummary,
      messages: [],
    });

    // Only the two core sections, but the summary overflowed onto more pages
    expect(sections.map((s) => s.title)).toEqual([
      "Summary",
      "Important in This Video",
    ]);
    expect(doc.internal.getNumberOfPages()).toBeGreaterThan(2);
    // Overflow page belongs to the Summary section, Important still starts its own page
    expect(sections[1].page).toBe(doc.internal.getNumberOfPages());
  });

  it("normalises the nested MongoDB summary shape", () => {
    const nested = {
      summary: {
        summary: "Nested summary text.",
        key_topics: ["Nested topic"],
        action_items: ["Nested task"],
      },
      key_topics: [],
      action_items: [],
    };

    const { sections } = buildMeetingReportPDF({ summary: nested });
    expect(sections.map((s) => s.title)).toEqual([
      "Summary",
      "Important in This Video",
      "Tasks / Action Items",
    ]);
  });

  it("renders without any data", () => {
    const { doc, sections } = buildMeetingReportPDF();
    expect(sections.length).toBeGreaterThanOrEqual(2);
    expect(doc.internal.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  });

  it("keeps all text inside the page frame, including on continuation pages", () => {
    // Regression: (1) after an overflow page break, drawFrame() re-enabled the
    // section-title font (bold 14pt), so already-wrapped body lines were drawn
    // oversized; (2) characters outside jsPDF's single-byte set (U+2011
    // hyphens from real LLM summaries, arrows, ZWSP, emoji…) forced whole
    // lines into UTF-16, rendering double-width past the border.
    const HELV = [
      278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,
      556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,
      1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,
      667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,
      333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,
      556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,
    ];
    const ptToMm = (v) => (v * 25.4) / 72;

    const { doc } = buildMeetingReportPDF({
      summary: {
        summary:
          Array.from(
            { length: 80 },
            (_, i) =>
              `Sentence ${i} of a deliberately long meeting summary that must continue onto several pages of the report without overflowing.`
          ).join(" ") +
          " Real LLM output also uses non\u2011breaking hyphens, \u2013 dashes, “smart quotes”, \u2192 arrows, ZWSP\u200B marks, ﬁ ligatures and \u{1F680} emoji that must not poison a line.",
        key_topics: [
          "A topic that is long enough to wrap across two lines when rendered in the content column",
          "Topic with U+2011 \u2011, U+2010 \u2010, prime ′, arrow \u2192 and emoji \u{1F680} that jsPDF cannot draw in one byte",
        ],
        action_items: [],
      },
      messages: [
        { sender: "user", text: "A question long enough to wrap across multiple lines with hyphen \u2011, quote “x” and emoji \u{1F680} inside it?" },
        { sender: "bot", text: "An answer that is also long enough to wrap and continue onto the next page of the PDF report document — with \u2011 and \u2192 inside." },
      ],
      filename: "overflow \u2011 “quoted” \u{1F680}.mp4",
    });

    // The summary must have overflowed onto continuation pages
    expect(doc.internal.getNumberOfPages()).toBeGreaterThan(2);

    // Extract every text run's position from the (uncompressed) content streams
    const raw = Buffer.from(doc.output(), "latin1").toString("latin1");
    const streams = [];
    const streamRe = /stream\r?\n([\s\S]*?)endstream/g;
    let sm;
    while ((sm = streamRe.exec(raw))) {
      if (sm[1].includes("BT")) streams.push(sm[1]);
    }
    // One content stream per page — nothing may go unchecked
    expect(streams.length).toBeGreaterThanOrEqual(doc.internal.getNumberOfPages());

    // No text run may be UTF-16 encoded (null bytes = double-width render)
    const allText = streams.join("");
    const tjRe = /\(((?:\\.|[^\\()])*)\)\s*Tj/g;
    let tj;
    let utf16Runs = 0;
    while ((tj = tjRe.exec(allText))) {
      if (tj[1].includes("\x00")) utf16Runs += 1;
    }
    expect(utf16Runs).toBe(0);

    const RIGHT_MM = 200; // inner edge of the border frame
    const BOTTOM_MM = 287;
    const violations = [];
    for (const s of streams) {
      const btRe = /BT([\s\S]*?)ET/g;
      let bm;
      while ((bm = btRe.exec(s))) {
        const body = bm[1];
        const size = parseFloat((body.match(/\/F\d+\s+([\d.]+)\s+Tf/) || [])[1] || "0");
        const tm = body.match(/1\s+0\s+0\s+1\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm/);
        const tj = body.match(/\(((?:\\.|[^\\()])*)\)\s*Tj/);
        if (!tm || !tj) continue;
        const x = ptToMm(parseFloat(tm[1]));
        const y = ptToMm(parseFloat(tm[2]));
        const text = tj[1].replace(/\\([0-7]{1,3})/g, (_, o) =>
          String.fromCharCode(parseInt(o, 8))
        );
        // Helvetica advance width for the run (over-estimate bold by 9%)
        const widthMm =
          ([...text].reduce((a, c) => {
            const code = c.charCodeAt(0);
            return a + (code >= 32 && code <= 126 ? HELV[code - 32] : 556);
          }, 0) /
            1000) *
          size *
          1.09 *
          (25.4 / 72);
        if (x + widthMm > RIGHT_MM + 0.5 || y > BOTTOM_MM + 0.5 || x < 9.5 || y < 9.5) {
          violations.push({ x: +x.toFixed(1), y: +y.toFixed(1), size, text: text.slice(0, 40) });
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("accepts history-loaded messages (role key instead of sender)", () => {
    const { sections } = buildMeetingReportPDF({
      summary: fullSummary,
      messages: [
        { role: "user", content: "Question from history" },
        { role: "assistant", content: "Answer from history" },
      ],
    });
    expect(sections.map((s) => s.title)).toContain("Chat: Questions & Answers");
  });
});

describe("getReportFileName", () => {
  it("derives a safe name from the meeting filename", () => {
    expect(getReportFileName("team standup #2.mp4")).toBe(
      "team_standup_2_Report.pdf"
    );
  });

  it("falls back to Meeting_Report.pdf", () => {
    expect(getReportFileName("")).toBe("Meeting_Report.pdf");
    expect(getReportFileName(undefined)).toBe("Meeting_Report.pdf");
  });
});
