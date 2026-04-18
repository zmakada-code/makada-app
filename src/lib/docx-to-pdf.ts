/**
 * DOCX to PDF Converter
 *
 * Converts Word documents (.docx) to PDF using mammoth for HTML extraction
 * and pdf-lib for PDF rendering. Preserves basic formatting (headings,
 * bold, italic, paragraphs, lists).
 *
 * Also provides a function to append a signing page to any PDF.
 */

import mammoth from "mammoth";
import {
  PDFDocument,
  PDFPage,
  PDFFont,
  rgb,
  StandardFonts,
} from "pdf-lib";
import type { SigningField } from "./lease-pdf-generator";

// Page dimensions (US Letter)
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_L = 60;
const MARGIN_R = 60;
const MARGIN_TOP = 60;
const MARGIN_BOTTOM = 60;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;

const BLACK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.35, 0.4, 0.5);
const LINE_COLOR = rgb(0.82, 0.84, 0.88);

interface TextBlock {
  type: "heading1" | "heading2" | "heading3" | "paragraph" | "list_item";
  text: string;
  bold: boolean;
}

/**
 * Parse mammoth HTML output into structured text blocks.
 */
function parseHtmlToBlocks(html: string): TextBlock[] {
  const blocks: TextBlock[] = [];

  // Strip style/script
  let clean = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

  // Match block-level elements
  const blockRegex =
    /<(h1|h2|h3|h4|h5|h6|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;

  while ((match = blockRegex.exec(clean)) !== null) {
    const tag = match[1].toLowerCase();
    const innerHtml = match[2];

    // Check if content is mostly bold
    const boldContent = innerHtml.match(/<strong>([\s\S]*?)<\/strong>/gi);
    const boldTextLength = boldContent
      ? boldContent.reduce(
          (sum, b) => sum + b.replace(/<[^>]+>/g, "").length,
          0
        )
      : 0;

    // Strip HTML tags for plain text
    let text = innerHtml
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#\d+;/g, "")
      .trim();

    if (!text) continue;

    let type: TextBlock["type"] = "paragraph";
    if (tag === "h1") type = "heading1";
    else if (tag === "h2") type = "heading2";
    else if (tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6")
      type = "heading3";
    else if (tag === "li") type = "list_item";

    const isBold =
      type.startsWith("heading") || boldTextLength > text.length * 0.5;

    blocks.push({ type, text, bold: isBold });
  }

  // If regex didn't capture much, fall back to raw text extraction
  if (blocks.length < 5) {
    const rawText = clean
      .replace(/<[^>]+>/g, "\n")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&#\d+;/g, "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    for (const line of rawText) {
      blocks.push({ type: "paragraph", text: line, bold: false });
    }
  }

  return blocks;
}

/**
 * Wrap text to fit within a given width. Returns an array of lines.
 */
function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  const paragraphs = text.split("\n");

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = `${currentLine} ${words[i]}`;
      const width = font.widthOfTextAtSize(test, fontSize);
      if (width <= maxWidth) {
        currentLine = test;
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Convert a DOCX buffer to a PDF buffer.
 */
export async function convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  // Convert DOCX to HTML using mammoth
  const result = await mammoth.convertToHtml({ buffer: docxBuffer });
  const html = result.value;

  // Parse HTML into text blocks
  const blocks = parseHtmlToBlocks(html);

  // Create PDF
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const boldFont = await pdf.embedFont(StandardFonts.TimesRomanBold);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN_TOP;

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN_BOTTOM) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN_TOP;
    }
  }

  for (const block of blocks) {
    let fontSize: number;
    let lineFont: PDFFont;
    let spacing: number;

    switch (block.type) {
      case "heading1":
        fontSize = 16;
        lineFont = boldFont;
        spacing = 24;
        break;
      case "heading2":
        fontSize = 13;
        lineFont = boldFont;
        spacing = 18;
        break;
      case "heading3":
        fontSize = 11;
        lineFont = boldFont;
        spacing = 14;
        break;
      case "list_item":
        fontSize = 10.5;
        lineFont = block.bold ? boldFont : font;
        spacing = 4;
        break;
      default:
        fontSize = 10.5;
        lineFont = block.bold ? boldFont : font;
        spacing = 6;
        break;
    }

    const prefix = block.type === "list_item" ? "•  " : "";
    const indentX = block.type === "list_item" ? MARGIN_L + 15 : MARGIN_L;
    const textWidth =
      block.type === "list_item" ? CONTENT_W - 15 : CONTENT_W;

    const lines = wrapText(
      prefix + block.text,
      lineFont,
      fontSize,
      textWidth
    );
    const blockHeight = lines.length * (fontSize + 4) + spacing;

    ensureSpace(blockHeight);

    // Extra space before headings
    if (block.type.startsWith("heading")) {
      y -= spacing / 2;
    }

    for (const line of lines) {
      ensureSpace(fontSize + 4);
      page.drawText(line, {
        x: indentX,
        y: y - fontSize,
        size: fontSize,
        font: lineFont,
        color: BLACK,
      });
      y -= fontSize + 4;
    }

    y -= spacing;
  }

  return Buffer.from(await pdf.save());
}

/**
 * Append a signing page to an existing PDF.
 * Returns the modified PDF buffer and the signing field metadata.
 */
export async function appendSigningPage(
  pdfBuffer: Buffer,
  tenantName: string,
  propertyAddress: string,
  unitLabel: string,
  landlordSigBuffer?: Buffer
): Promise<{
  pdfBuffer: Buffer;
  signingFields: SigningField[];
  pageCount: number;
}> {
  const pdf = await PDFDocument.load(pdfBuffer);
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const boldFont = await pdf.embedFont(StandardFonts.TimesRomanBold);

  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const pageIndex = pdf.getPageCount() - 1;
  let y = PAGE_H - MARGIN_TOP;

  // Title
  const title = "SIGNATURE PAGE";
  const titleWidth = boldFont.widthOfTextAtSize(title, 16);
  page.drawText(title, {
    x: (PAGE_W - titleWidth) / 2,
    y: y - 16,
    size: 16,
    font: boldFont,
    color: BLACK,
  });
  y -= 40;

  // Property info
  page.drawText(`Property: ${propertyAddress}`, {
    x: MARGIN_L,
    y: y - 11,
    size: 11,
    font: font,
    color: MUTED,
  });
  y -= 18;
  page.drawText(`Unit: ${unitLabel}`, {
    x: MARGIN_L,
    y: y - 11,
    size: 11,
    font: font,
    color: MUTED,
  });
  y -= 30;

  // Agreement text
  const agreementText =
    "By signing below, the parties acknowledge that they have read, understood, and agree " +
    "to all terms and conditions set forth in this Lease Agreement.";
  const agreementLines = wrapText(agreementText, font, 10.5, CONTENT_W);
  for (const line of agreementLines) {
    page.drawText(line, {
      x: MARGIN_L,
      y: y - 10.5,
      size: 10.5,
      font: font,
      color: BLACK,
    });
    y -= 15;
  }
  y -= 20;

  // Divider
  page.drawLine({
    start: { x: MARGIN_L, y },
    end: { x: PAGE_W - MARGIN_R, y },
    thickness: 0.5,
    color: LINE_COLOR,
  });
  y -= 30;

  // LANDLORD section
  page.drawText("LANDLORD:", {
    x: MARGIN_L,
    y: y - 12,
    size: 12,
    font: boldFont,
    color: BLACK,
  });
  y -= 30;

  page.drawText("Makada Properties LLC", {
    x: MARGIN_L,
    y: y - 11,
    size: 11,
    font: font,
    color: BLACK,
  });
  y -= 20;

  // Landlord signature
  if (landlordSigBuffer) {
    try {
      let sigImg;
      try {
        sigImg = await pdf.embedPng(landlordSigBuffer);
      } catch {
        sigImg = await pdf.embedJpg(landlordSigBuffer);
      }
      const dims = sigImg.scale(1);
      const scale = Math.min(180 / dims.width, 50 / dims.height);
      page.drawImage(sigImg, {
        x: MARGIN_L,
        y: y - 50,
        width: dims.width * scale,
        height: dims.height * scale,
      });
    } catch {
      page.drawText("[Landlord Signature]", {
        x: MARGIN_L,
        y: y - 30,
        size: 11,
        font: font,
        color: MUTED,
      });
    }
  } else {
    page.drawText("[Landlord Signature]", {
      x: MARGIN_L,
      y: y - 30,
      size: 11,
      font: font,
      color: MUTED,
    });
  }
  y -= 60;

  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  page.drawText(`Date: ${today}`, {
    x: MARGIN_L,
    y: y - 11,
    size: 11,
    font: font,
    color: BLACK,
  });
  y -= 40;

  // Divider
  page.drawLine({
    start: { x: MARGIN_L, y },
    end: { x: PAGE_W - MARGIN_R, y },
    thickness: 0.5,
    color: LINE_COLOR,
  });
  y -= 30;

  // TENANT section
  page.drawText("TENANT:", {
    x: MARGIN_L,
    y: y - 12,
    size: 12,
    font: boldFont,
    color: BLACK,
  });
  y -= 25;

  page.drawText(tenantName, {
    x: MARGIN_L,
    y: y - 11,
    size: 11,
    font: font,
    color: BLACK,
  });
  y -= 30;

  // Signing fields
  const signingFields: SigningField[] = [];

  // Signature field
  const sigFieldY = y - 55;
  page.drawText("Signature:", {
    x: MARGIN_L,
    y: y - 11,
    size: 10,
    font: font,
    color: MUTED,
  });
  page.drawRectangle({
    x: MARGIN_L,
    y: sigFieldY,
    width: 250,
    height: 45,
    borderColor: LINE_COLOR,
    borderWidth: 1,
    color: rgb(0.96, 0.97, 1.0),
  });
  signingFields.push({
    id: "tenant_signature",
    type: "signature",
    label: "Tenant Signature",
    page: pageIndex,
    x: MARGIN_L,
    y: sigFieldY,
    width: 250,
    height: 45,
  });
  y = sigFieldY - 20;

  // Initials field
  const initFieldY = y - 35;
  page.drawText("Initials:", {
    x: MARGIN_L,
    y: y - 11,
    size: 10,
    font: font,
    color: MUTED,
  });
  page.drawRectangle({
    x: MARGIN_L,
    y: initFieldY,
    width: 80,
    height: 30,
    borderColor: LINE_COLOR,
    borderWidth: 1,
    color: rgb(0.96, 0.97, 1.0),
  });
  signingFields.push({
    id: "tenant_initials",
    type: "initials",
    label: "Tenant Initials",
    page: pageIndex,
    x: MARGIN_L,
    y: initFieldY,
    width: 80,
    height: 30,
  });
  y = initFieldY - 20;

  // Date field
  const dateFieldY = y - 30;
  page.drawText("Date:", {
    x: MARGIN_L,
    y: y - 11,
    size: 10,
    font: font,
    color: MUTED,
  });
  page.drawRectangle({
    x: MARGIN_L,
    y: dateFieldY,
    width: 180,
    height: 25,
    borderColor: LINE_COLOR,
    borderWidth: 1,
    color: rgb(0.96, 0.97, 1.0),
  });
  signingFields.push({
    id: "tenant_date",
    type: "date",
    label: "Date Signed",
    page: pageIndex,
    x: MARGIN_L,
    y: dateFieldY,
    width: 180,
    height: 25,
  });

  const pdfBytes = await pdf.save();
  return {
    pdfBuffer: Buffer.from(pdfBytes),
    signingFields,
    pageCount: pdf.getPageCount(),
  };
}
