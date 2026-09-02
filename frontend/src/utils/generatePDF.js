import { jsPDF } from "jspdf";

export function generateMeetingPDF(summary, messages) {
  const doc = new jsPDF();
  let y = 20;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const contentWidth = doc.internal.pageSize.width - 2 * margin;

  const checkNewPage = (needed = 20) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Title
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Meeting Summary Report", margin, y);
  y += 10;

  // Date line
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, margin, y);
  doc.setTextColor(0);
  y += 12;

  // Divider
  doc.setDrawColor(200);
  doc.line(margin, y, margin + contentWidth, y);
  y += 10;

  // --- Summary Section ---
  if (summary?.summary) {
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", margin, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const summaryLines = doc.splitTextToSize(summary.summary, contentWidth);
    for (const line of summaryLines) {
      checkNewPage(8);
      doc.text(line, margin, y);
      y += 6;
    }
    y += 6;
  }

  // --- Key Topics ---
  if (summary?.key_topics?.length > 0) {
    checkNewPage(20);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Key Topics", margin, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    for (const topic of summary.key_topics) {
      checkNewPage(8);
      doc.text(`•  ${topic}`, margin, y);
      y += 6;
    }
    y += 6;
  }

  // --- Action Items ---
  if (summary?.action_items?.length > 0) {
    checkNewPage(20);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Action Items", margin, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    for (const item of summary.action_items) {
      checkNewPage(8);
      doc.text(`☐  ${item}`, margin, y);
      y += 6;
    }
    y += 6;
  }

  // --- Q&A Section ---
  const qnaMessages = messages.filter(
    (msg) => msg.sender === "user" || msg.sender === "bot"
  );
  if (qnaMessages.length > 0) {
    checkNewPage(20);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Questions & Answers", margin, y);
    y += 10;

    let qNum = 1;
    for (let i = 0; i < qnaMessages.length; i++) {
      const msg = qnaMessages[i];

      if (msg.sender === "user") {
        checkNewPage(20);
        // Question
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        const qLabel = `Q${qNum}. `;
        doc.text(qLabel, margin, y);
        const qLines = doc.splitTextToSize(msg.text, contentWidth - doc.getTextWidth(qLabel));
        doc.text(qLines[0], margin + doc.getTextWidth(qLabel), y);
        if (qLines.length > 1) {
          for (let li = 1; li < qLines.length; li++) {
            y += 6;
            checkNewPage(8);
            doc.text(qLines[li], margin + 10, y);
          }
        }
        y += 8;

        // Look for the next bot response
        if (i + 1 < qnaMessages.length && qnaMessages[i + 1].sender === "bot") {
          const answer = qnaMessages[i + 1];
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(60);
          doc.text("Answer:", margin, y);
          doc.setTextColor(0);
          y += 6;

          doc.setFont("helvetica", "normal");
          const aLines = doc.splitTextToSize(answer.text, contentWidth - 10);
          for (const line of aLines) {
            checkNewPage(8);
            doc.text(line, margin + 5, y);
            y += 6;
          }
          y += 8;
          i++; // skip bot message
        }

        qNum++;
      }
    }
  }

  // Footer
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${totalPages}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: "center" }
    );
  }

  doc.save("Meeting_Summary_Report.pdf");
}
