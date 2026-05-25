import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ReportData } from "@/lib/types";

export async function downloadReportPdf(report: ReportData) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 54;

  const ensureSpace = (height: number) => {
    if (y - height < margin) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  const addWrappedText = (text: string, size = 10, lineHeight = 15) => {
    const lines = wrapText(text, contentWidth, size, regular);
    ensureSpace(lines.length * lineHeight + 6);
    lines.forEach((line) => {
      page.drawText(line, {
        x: margin,
        y,
        size,
        font: regular,
        color: rgb(0.06, 0.09, 0.16)
      });
      y -= lineHeight;
    });
    y -= 8;
  };

  const addSectionTitle = (title: string) => {
    ensureSpace(32);
    page.drawText(title, {
      x: margin,
      y,
      size: 13,
      font: bold,
      color: rgb(0.08, 0.33, 0.31)
    });
    y -= 20;
  };

  page.drawRectangle({
    x: 0,
    y: pageHeight - 112,
    width: pageWidth,
    height: 112,
    color: rgb(0.06, 0.09, 0.16)
  });
  page.drawText("InsightPDF Report", {
    x: margin,
    y,
    size: 22,
    font: bold,
    color: rgb(1, 1, 1)
  });
  y -= 28;
  page.drawText(report.sourceDomain, {
    x: margin,
    y,
    size: 10,
    font: regular,
    color: rgb(1, 1, 1)
  });
  y = pageHeight - 148;

  addSectionTitle("Website Title");
  addWrappedText(report.title, 12, 17);

  addSectionTitle("Summary");
  addWrappedText(report.summary, 10.5, 16);

  addSectionTitle("Key Insights");
  report.keyInsights.forEach((insight, index) => {
    addWrappedText(`${index + 1}. ${insight}`, 10, 15);
  });

  if (report.headings.length > 0) {
    addSectionTitle("Important Headings");
    report.headings.slice(0, 10).forEach((heading) => addWrappedText(`- ${heading}`, 10, 15));
  }

  if (report.notableLinks.length > 0) {
    addSectionTitle("Notable Public Links");
    report.notableLinks
      .slice(0, 8)
      .forEach((link) => addWrappedText(`- ${link.label}: ${link.href}`, 9.5, 14));
  }

  report.sections.forEach((section) => {
    addSectionTitle(section.label);
    addWrappedText(section.body, 10, 15);
  });

  ensureSpace(36);
  page.drawText(`Source: ${report.url}`.slice(0, 105), {
    x: margin,
    y: 42,
    size: 8,
    font: regular,
    color: rgb(0.39, 0.45, 0.55)
  });
  page.drawText(`Generated: ${new Date(report.extractedAt).toLocaleString()}`, {
    x: margin,
    y: 28,
    size: 8,
    font: regular,
    color: rgb(0.39, 0.45, 0.55)
  });

  const bytes = await doc.save();
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  const blob = new Blob([arrayBuffer], { type: "application/pdf" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${sanitizeFileName(report.title || "insightpdf-report")}.pdf`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function sanitizeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70);
}

function wrapText(text: string, maxWidth: number, size: number, font: { widthOfTextAtSize(text: string, size: number): number }) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      return;
    }
    if (current) {
      lines.push(current);
    }
    current = word;
  });

  if (current) {
    lines.push(current);
  }

  return lines;
}
