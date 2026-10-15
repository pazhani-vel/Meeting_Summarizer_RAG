import { jsPDF } from "jspdf";

/**
 * Full meeting report PDF.
 *
 * Each section starts on its own page, and every page is drawn with a
 * border frame + dark header band (matching the app's red accent):
 *
 *   1. Summary                  — always
 *   2. Important in This Video  — key topics extracted from the video
 *   3. Tasks / Action Items     — only when at least one task was given
 *   4. Chat: Questions & Answers— only when a chat exists
 *
 * Kept separate from ./generatePDF (the legacy single-flow report) so the
 * existing report stays untouched.
 */

// ── Layout (mm, A4) ──────────────────────────────────────────────────

const INSET = 10; // page-edge inset of the border frame
const HEADER_H = 20; // dark header band height
const PAD = 8; // inner padding from the border
const FOOTER_H = 10; // reserved footer strip height

// ── Palette ──────────────────────────────────────────────────────────

const INK = [16, 16, 16];
const ACCENT = [220, 38, 38]; // matches --red in App.css
const BORDER = [176, 176, 176];
const MUTED = [132, 132, 132];
const HEADER_MUTED = [150, 150, 150];
const BODY = [38, 38, 38];
const WHITE = [255, 255, 255];

const SECTION_SUMMARY = "Summary";
const SECTION_IMPORTANT = "Important in This Video";
const SECTION_TASKS = "Tasks / Action Items";
const SECTION_CHAT = "Chat: Questions & Answers";

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * The summary document may be stored flat ({summary, key_topics, ...})
 * or nested ({summary: {summary, key_topics, ...}}) depending on where it
 * came from (upload response vs. MongoDB). Normalise both shapes.
 */
function normalizeSummary(summary) {
  if (!summary) return { summary: "", key_topics: [], action_items: [] };
  let s = summary;
  if (typeof s.summary === "object" && s.summary !== null) {
    s = { ...s, ...s.summary };
  }
  const text = typeof s.summary === "string" ? s.summary : "";
  const list = (v) => (Array.isArray(v) ? v.filter((x) => x != null && String(x).trim()) : []);
  return {
    summary: sanitizePdfText(text.trim()),
    key_topics: list(s.key_topics).map((t) => sanitizePdfText(String(t))).filter((t) => t.trim()),
    action_items: list(s.action_items).map((t) => sanitizePdfText(String(t))).filter((t) => t.trim()),
  };
}

/** Map a chat message to "user" | "bot" (accepts sender or role keys). */
function roleOf(msg) {
  if (!msg) return null;
  if (msg.sender === "user" || msg.sender === "bot") return msg.sender;
  if (msg.role === "user") return "user";
  if (msg.role === "assistant" || msg.role === "bot") return "bot";
  return null;
}

/** Message body — frontend state uses "text", MongoDB history uses "content". */
function textOf(msg) {
  if (!msg) return "";
  if (typeof msg.text === "string") return msg.text;
  if (typeof msg.content === "string") return msg.content;
  return "";
}

// Characters Helvetica can draw directly (single-byte / WinAnsi set).
// Everything else makes jsPDF re-encode the whole run as UTF-16, which
// renders at about double width and pushes words off the page border.
const PDF_SAFE =
  /[\n\x20-\x7E\xA0-\xFF\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u2013\u2014\u2018\u2019\u201C\u201D\u2020\u2021\u2022\u2026\u2030\u2039\u203A\u2122]/;

/**
 * Sanitise text so every drawn run stays in jsPDF's single-byte set:
 * map unmappable characters (U+2010/2011/2012 hyphens, arrows, primes,
 * invisible marks, ligatures…) to renderable equivalents, decompose what
 * can be decomposed, and drop the rest (emoji, CJK, exotic symbols — none
 * of them exist in Helvetica anyway). Must run BEFORE any measuring or
 * wrapping so wrap widths always match what gets drawn.
 */
function sanitizePdfText(value) {
  let s = String(value ?? "");
  if (!s) return "";
  s = s
    .replace(/\uFB00/g, "ff")
    .replace(/\uFB01/g, "fi")
    .replace(/\uFB02/g, "fl")
    .replace(/\uFB03/g, "ffi")
    .replace(/\uFB04/g, "ffl")
    .replace(/[\u2010\u2011\u2012\u2015\u2043\u2212]/g, "-") // hyphen family
    .replace(/[\u2000-\u200A\u2007\u202F\u205F\u3000]/g, " ") // exotic spaces
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "") // invisible marks
    .replace(/[\u2032\u2035]/g, "'")
    .replace(/[\u2033\u2036]/g, '"')
    .replace(/[\u2190-\u21FF]/g, "-"); // arrows

  let out = "";
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    // ASCII control characters (except newline) and DEL/C1 → space
    if ((code < 0x20 && ch !== "\n") || (code >= 0x7f && code <= 0x9f)) {
      out += " ";
      continue;
    }
    if (PDF_SAFE.test(ch)) {
      out += ch;
      continue;
    }
    // Decomposable characters (accented letters outside Latin-1, some
    // Extended-A) keep their base letters; the rest are dropped.
    const dec = ch.normalize("NFD").replace(/[\u0300-\u036F]/g, "");
    if (dec && dec !== ch && [...dec].every((c) => PDF_SAFE.test(c))) out += dec;
  }
  return out;
}

/** Filesystem-safe report file name derived from the meeting filename. */
export function getReportFileName(filename) {
  const base =
    (filename || "")
      .replace(/\.[^.]+$/, "")
      .replace(/[^\w.-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "") || "Meeting";
  return `${base}_Report.pdf`;
}

// ── Builder ──────────────────────────────────────────────────────────

export function buildMeetingReportPDF({ summary, messages = [], filename = "" } = {}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const W = doc.internal.pageSize.width;
  const H = doc.internal.pageSize.height;
  const X = INSET + PAD; // content left edge
  const CONTENT_W = W - 2 * X; // content width
  const TOP = INSET + HEADER_H + 8; // content top
  const BOTTOM = H - INSET - FOOTER_H - 2; // content bottom limit

  const norm = normalizeSummary(summary);
  const safeFilename = sanitizePdfText((filename || "").trim()) || "Untitled meeting";

  const sections = []; // { title, page } — one entry per section start
  let sectionBase = ""; // section title without continuation suffix
  let y = TOP;
  let started = false;

  // Truncate text so it fits a given width at the current font.
  const fit = (text, maxWidth) => {
    if (doc.getTextWidth(text) <= maxWidth) return text;
    let t = String(text);
    while (t.length > 1 && doc.getTextWidth(`${t}…`) > maxWidth) t = t.slice(0, -1);
    return `${t}…`;
  };

  // Draw border frame + header band for the current section.
  const drawFrame = (title) => {
    // Header band
    doc.setFillColor(INK[0], INK[1], INK[2]);
    doc.rect(INSET, INSET, W - 2 * INSET, HEADER_H, "F");

    // Accent strip along the bottom of the band
    doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.rect(INSET, INSET + HEADER_H - 1.2, W - 2 * INSET, 1.2, "F");

    // Eyebrow (left) + source file (right)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(HEADER_MUTED[0], HEADER_MUTED[1], HEADER_MUTED[2]);
    doc.text("AI MEETING REPORT", X, INSET + 7);
    doc.setFont("helvetica", "normal");
    doc.text(
      fit(safeFilename, CONTENT_W * 0.55),
      W - INSET - PAD,
      INSET + 7,
      { align: "right" }
    );

    // Section title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
    doc.text(title, X, INSET + 15.5);

    // Border frame (drawn last so it sits above the band)
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.setLineWidth(0.4);
    doc.rect(INSET, INSET, W - 2 * INSET, H - 2 * INSET, "S");

    y = TOP;
  };

  // Start a new section on its own page.
  const startSection = (title) => {
    if (started) doc.addPage();
    started = true;
    sectionBase = title;
    sections.push({ title, page: doc.internal.getNumberOfPages() });
    drawFrame(title);
  };

  // Wrap to a continuation page when the current section overflows.
  const ensureRoom = (needed) => {
    if (y + needed > BOTTOM) {
      doc.addPage();
      drawFrame(`${sectionBase} (cont.)`);
      // NOTE: drawFrame leaves the section-title font active — every writer
      // must call setBody() again after ensureRoom() before drawing text.
    }
  };

  // Re-apply the body font/colour. Must be called after every ensureRoom().
  const setBody = (fontSize, style = "normal", color = BODY) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
  };

  // Wrap text to the current font. splitTextToSize can leave tokens longer
  // than the line width (URLs, ids) — hard-break those on measured bounds
  // so nothing can ever run past the right edge of the content area.
  const wrapLines = (text, maxWidth) => {
    const raw = doc.splitTextToSize(String(text), maxWidth);
    const out = [];
    for (const line of raw) {
      if (doc.getTextWidth(line) <= maxWidth) {
        out.push(line);
        continue;
      }
      let cur = "";
      for (const ch of String(line)) {
        if (cur && doc.getTextWidth(cur + ch) > maxWidth) {
          out.push(cur);
          cur = ch;
        } else {
          cur += ch;
        }
      }
      if (cur) out.push(cur);
    }
    return out;
  };

  // Write wrapped text, handling page overflow.
  const writeWrapped = (text, opts = {}) => {
    const {
      indent = 0,
      lineH = 6,
      fontSize = 11,
      style = "normal",
      color = BODY,
    } = opts;
    setBody(fontSize, style, color);
    const lines = wrapLines(text, CONTENT_W - indent);
    for (const line of lines) {
      ensureRoom(lineH);
      setBody(fontSize, style, color); // ensureRoom may have reset the font
      doc.text(line, X + indent, y);
      y += lineH;
    }
  };

  const writePlaceholder = (text) =>
    writeWrapped(text, { fontSize: 10.5, style: "italic", color: MUTED, lineH: 6 });

  // ── 1. Summary ─────────────────────────────────────────────────────
  startSection(SECTION_SUMMARY);
  if (norm.summary) {
    writeWrapped(norm.summary, { fontSize: 11.5, lineH: 6.5 });
  } else {
    writePlaceholder("No summary is available for this meeting.");
  }

  // ── 2. Important in this video ─────────────────────────────────────
  startSection(SECTION_IMPORTANT);
  if (norm.key_topics.length === 0) {
    writePlaceholder("No key topics were extracted for this meeting.");
  } else {
    const TOPIC_W = CONTENT_W - 7;
    for (const topic of norm.key_topics) {
      setBody(11);
      const lines = wrapLines(topic, TOPIC_W);
      ensureRoom(6.5);
      setBody(11);
      doc.text("•", X, y);
      doc.text(lines[0], X + 7, y);
      y += 6.5;
      for (let i = 1; i < lines.length; i++) {
        ensureRoom(6.5);
        setBody(11);
        doc.text(lines[i], X + 7, y);
        y += 6.5;
      }
      y += 1.5;
    }
  }

  // ── 3. Tasks / action items (only when any task was given) ─────────
  if (norm.action_items.length > 0) {
    startSection(SECTION_TASKS);
    for (const item of norm.action_items) {
      setBody(11); // set BEFORE wrapping so the split matches the drawn font
      const lines = wrapLines(item, CONTENT_W - 7);
      ensureRoom(6.5);
      setBody(11);
      // Checkbox (drawn as a vector square — renders on every reader)
      doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.setLineWidth(0.35);
      doc.rect(X, y - 2.7, 2.8, 2.8);
      doc.text(lines[0], X + 7, y);
      y += 6.5;
      for (let i = 1; i < lines.length; i++) {
        ensureRoom(6.5);
        setBody(11);
        doc.text(lines[i], X + 7, y);
        y += 6.5;
      }
      y += 1.5;
    }
  }

  // ── 4. Chat: questions & answers (only when a chat exists) ─────────
  const chat = (Array.isArray(messages) ? messages : [])
    .map((m) => ({ role: roleOf(m), text: sanitizePdfText(textOf(m)) }))
    .filter((m) => m.role && m.text.trim());
  if (chat.length > 0) {
    startSection(SECTION_CHAT);
    let qNum = 0;
    for (const msg of chat) {
      if (msg.role === "user") {
        // Question — inline "Q1." label, wrapped question text
        qNum += 1;
        const label = `Q${qNum}. `;
        ensureRoom(6.5);
        setBody(11.5, "bold", INK);
        doc.text(label, X, y);
        const labelW = doc.getTextWidth(label);
        setBody(11.5, "normal", BODY);
        const lines = wrapLines(textOf(msg), CONTENT_W - labelW);
        doc.text(lines[0], X + labelW, y);
        y += 6.5;
        for (let i = 1; i < lines.length; i++) {
          ensureRoom(6.5);
          setBody(11.5, "normal", BODY);
          doc.text(lines[i], X + 10, y);
          y += 6.5;
        }
      } else {
        // Answer — keep the label with at least its first line
        ensureRoom(12);
        setBody(9.5, "bold", ACCENT);
        doc.text("ANSWER", X, y);
        y += 5.5;
        writeWrapped(textOf(msg), { fontSize: 11, indent: 6, lineH: 6 });
      }
      y += 4; // gap between Q/A pairs
    }
  }

  // ── Footers (page numbers + generation date) ───────────────────────
  const total = doc.internal.getNumberOfPages();
  const generatedOn = sanitizePdfText(new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }));
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.setLineWidth(0.3);
    doc.line(X, H - INSET - FOOTER_H, W - X, H - INSET - FOOTER_H);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(`Generated on ${generatedOn}`, X, H - INSET - 4);
    doc.text(`Page ${p} of ${total}`, W - X, H - INSET - 4, { align: "right" });
  }

  return { doc, sections };
}

/** Build the report and trigger the browser download. */
export function generateMeetingReportPDF(data = {}) {
  const { doc } = buildMeetingReportPDF(data);
  const fileName = getReportFileName(data.filename);
  doc.save(fileName);
  return fileName;
}
