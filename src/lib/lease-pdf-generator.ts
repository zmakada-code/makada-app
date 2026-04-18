/**
 * Lease PDF Generator
 *
 * Generates a professional multi-page residential lease agreement as a PDF
 * using pdf-lib. Embeds landlord signature and leaves designated fields
 * for tenant signature and initials at specific spots.
 *
 * Returns both the PDF buffer and metadata about signing field locations
 * so the tenant portal can render a DocuSign-style signing experience.
 */

import fs from "fs";
import path from "path";
import {
  PDFDocument,
  PDFPage,
  PDFFont,
  rgb,
  StandardFonts,
  PDFImage,
} from "pdf-lib";

export type LeaseInput = {
  TENANT_1_NAME: string;
  TENANT_2_NAME: string;
  PROPERTY_ADDRESS: string;
  UNIT_NUMBER: string;
  BEDROOM_COUNT: string;
  BATHROOM_COUNT: string;
  RENT_AMOUNT: string;
  SECURITY_DEPOSIT: string;
  START_DATE: string;
  END_DATE: string;
  EFFECTIVE_DATE: string;
  PARKING_SPACE: string;
  STORAGE_DESCRIPTION: string;
  TENANT_1_INITIALS: string;
  TENANT_2_INITIALS: string;
  TENANT_1_SIGN_DATE: string;
  TENANT_2_SIGN_DATE: string;
};

/** A field the tenant must fill when signing */
export type SigningField = {
  id: string;
  type: "signature" | "initials" | "date";
  label: string;
  page: number; // 0-indexed page number
  x: number;
  y: number; // PDF coords (bottom-left origin)
  width: number;
  height: number;
};

export type LeaseGenerationResult = {
  pdfBuffer: Buffer;
  signingFields: SigningField[];
  pageCount: number;
};

const LANDLORD_SIG_PATH = path.join(
  process.cwd(),
  "templates",
  "makada-signature.png"
);

// Page dimensions
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_L = 60;
const MARGIN_R = 60;
const MARGIN_TOP = 60;
const MARGIN_BOTTOM = 60;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;

// Colors
const BLACK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.35, 0.4, 0.5);
const ACCENT = rgb(0.31, 0.27, 0.9);
const LINE_COLOR = rgb(0.82, 0.84, 0.88);
const FIELD_BG = rgb(0.96, 0.97, 1.0);
const FIELD_BORDER = rgb(0.7, 0.72, 0.85);

/**
 * Helper to wrap text to fit within a given width.
 */
function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Format address with unit inserted.
 */
function formatAddressWithUnit(address: string, unit: string): string {
  if (!unit) return address;
  const parts = address.split(",");
  if (parts.length >= 2) {
    return `${parts[0].trim()}, Apartment ${unit},${parts.slice(1).join(",")}`;
  }
  return `${address}, Apartment ${unit}`;
}

class PdfWriter {
  private pdf: PDFDocument;
  private pages: PDFPage[] = [];
  private currentPage!: PDFPage;
  private y: number = PAGE_H - MARGIN_TOP;
  private font!: PDFFont;
  private fontBold!: PDFFont;
  private fontItalic!: PDFFont;
  private fontBoldItalic!: PDFFont;
  private signingFields: SigningField[] = [];
  private pageIndex: number = 0;

  constructor(pdf: PDFDocument) {
    this.pdf = pdf;
  }

  async init() {
    this.font = await this.pdf.embedFont(StandardFonts.TimesRoman);
    this.fontBold = await this.pdf.embedFont(StandardFonts.TimesRomanBold);
    this.fontItalic = await this.pdf.embedFont(StandardFonts.TimesRomanItalic);
    this.fontBoldItalic = await this.pdf.embedFont(
      StandardFonts.TimesRomanBoldItalic
    );
    this.newPage();
  }

  private newPage() {
    this.currentPage = this.pdf.addPage([PAGE_W, PAGE_H]);
    this.pages.push(this.currentPage);
    this.pageIndex = this.pages.length - 1;
    this.y = PAGE_H - MARGIN_TOP;
  }

  private ensureSpace(needed: number) {
    if (this.y - needed < MARGIN_BOTTOM) {
      this.addPageNumber();
      this.newPage();
    }
  }

  private addPageNumber() {
    const pageNum = `Page ${this.pages.length}`;
    const w = this.font.widthOfTextAtSize(pageNum, 8);
    this.currentPage.drawText(pageNum, {
      x: PAGE_W / 2 - w / 2,
      y: 30,
      font: this.font,
      size: 8,
      color: MUTED,
    });
  }

  drawTitle(text: string) {
    this.ensureSpace(40);
    const w = this.fontBold.widthOfTextAtSize(text, 18);
    this.currentPage.drawText(text, {
      x: PAGE_W / 2 - w / 2,
      y: this.y,
      font: this.fontBold,
      size: 18,
      color: BLACK,
    });
    this.y -= 28;
  }

  drawSubtitle(text: string) {
    this.ensureSpace(24);
    const w = this.font.widthOfTextAtSize(text, 10);
    this.currentPage.drawText(text, {
      x: PAGE_W / 2 - w / 2,
      y: this.y,
      font: this.font,
      size: 10,
      color: MUTED,
    });
    this.y -= 18;
  }

  drawLine() {
    this.ensureSpace(10);
    this.currentPage.drawLine({
      start: { x: MARGIN_L, y: this.y },
      end: { x: PAGE_W - MARGIN_R, y: this.y },
      thickness: 0.75,
      color: LINE_COLOR,
    });
    this.y -= 12;
  }

  drawSectionHeader(number: string, title: string) {
    this.ensureSpace(30);
    this.y -= 8;
    this.currentPage.drawText(`${number}. ${title}`, {
      x: MARGIN_L,
      y: this.y,
      font: this.fontBold,
      size: 11,
      color: BLACK,
    });
    this.y -= 18;
  }

  drawParagraph(text: string, fontSize = 9.5, indent = 0) {
    const lines = wrapText(
      text,
      this.font,
      fontSize,
      CONTENT_W - indent
    );
    const lineHeight = fontSize + 4;
    this.ensureSpace(lineHeight * Math.min(lines.length, 3));

    for (const line of lines) {
      this.ensureSpace(lineHeight);
      this.currentPage.drawText(line, {
        x: MARGIN_L + indent,
        y: this.y,
        font: this.font,
        size: fontSize,
        color: BLACK,
      });
      this.y -= lineHeight;
    }
    this.y -= 4;
  }

  drawBoldParagraph(text: string, fontSize = 9.5) {
    const lines = wrapText(text, this.fontBold, fontSize, CONTENT_W);
    const lineHeight = fontSize + 4;
    this.ensureSpace(lineHeight * Math.min(lines.length, 3));

    for (const line of lines) {
      this.ensureSpace(lineHeight);
      this.currentPage.drawText(line, {
        x: MARGIN_L,
        y: this.y,
        font: this.fontBold,
        size: fontSize,
        color: BLACK,
      });
      this.y -= lineHeight;
    }
    this.y -= 4;
  }

  drawLabelValue(label: string, value: string, fontSize = 9.5) {
    this.ensureSpace(16);
    this.currentPage.drawText(label, {
      x: MARGIN_L,
      y: this.y,
      font: this.fontBold,
      size: fontSize,
      color: MUTED,
    });
    const labelW = this.fontBold.widthOfTextAtSize(label, fontSize);
    this.currentPage.drawText(` ${value}`, {
      x: MARGIN_L + labelW,
      y: this.y,
      font: this.font,
      size: fontSize,
      color: BLACK,
    });
    this.y -= fontSize + 6;
  }

  drawSpace(h: number) {
    this.y -= h;
  }

  /**
   * Draw an initials field at the current position.
   * Returns the field metadata.
   */
  drawInitialsField(fieldId: string, label: string): SigningField {
    this.ensureSpace(28);
    const fieldW = 80;
    const fieldH = 22;
    const fieldX = PAGE_W - MARGIN_R - fieldW;
    const fieldY = this.y - fieldH + 4;

    // Draw box
    this.currentPage.drawRectangle({
      x: fieldX,
      y: fieldY,
      width: fieldW,
      height: fieldH,
      borderColor: FIELD_BORDER,
      borderWidth: 1,
      color: FIELD_BG,
    });

    // Label
    this.currentPage.drawText("Initials ___", {
      x: fieldX + 6,
      y: fieldY + 7,
      font: this.fontItalic,
      size: 8,
      color: MUTED,
    });

    const field: SigningField = {
      id: fieldId,
      type: "initials",
      label,
      page: this.pageIndex,
      x: fieldX,
      y: fieldY,
      width: fieldW,
      height: fieldH,
    };
    this.signingFields.push(field);
    return field;
  }

  /**
   * Draw a signature field (larger box for full signature).
   */
  drawSignatureField(
    fieldId: string,
    label: string,
    signerLabel: string
  ): SigningField {
    this.ensureSpace(70);
    const fieldW = 220;
    const fieldH = 50;
    const fieldX = MARGIN_L;
    const fieldY = this.y - fieldH;

    // Label above
    this.currentPage.drawText(signerLabel, {
      x: MARGIN_L,
      y: this.y + 2,
      font: this.fontBold,
      size: 10,
      color: BLACK,
    });
    this.y -= 4;

    // Draw signature box
    this.currentPage.drawRectangle({
      x: fieldX,
      y: fieldY,
      width: fieldW,
      height: fieldH,
      borderColor: FIELD_BORDER,
      borderWidth: 1.5,
      color: FIELD_BG,
    });

    // Placeholder text
    this.currentPage.drawText("Sign here", {
      x: fieldX + fieldW / 2 - 20,
      y: fieldY + fieldH / 2 - 4,
      font: this.fontItalic,
      size: 9,
      color: MUTED,
    });

    // Signature line at bottom of box
    this.currentPage.drawLine({
      start: { x: fieldX + 10, y: fieldY + 12 },
      end: { x: fieldX + fieldW - 10, y: fieldY + 12 },
      thickness: 0.5,
      color: BLACK,
    });

    const field: SigningField = {
      id: fieldId,
      type: "signature",
      label,
      page: this.pageIndex,
      x: fieldX,
      y: fieldY,
      width: fieldW,
      height: fieldH,
    };
    this.signingFields.push(field);

    this.y = fieldY - 6;

    // Name line below
    this.currentPage.drawText(`Name: ${label}`, {
      x: MARGIN_L,
      y: this.y,
      font: this.font,
      size: 9,
      color: BLACK,
    });
    this.y -= 14;

    // Date field
    const dateFieldId = fieldId.replace("signature", "date");
    this.currentPage.drawText("Date: ____________", {
      x: MARGIN_L,
      y: this.y,
      font: this.font,
      size: 9,
      color: BLACK,
    });

    const dateField: SigningField = {
      id: dateFieldId,
      type: "date",
      label: `${label} signing date`,
      page: this.pageIndex,
      x: MARGIN_L + 30,
      y: this.y - 2,
      width: 100,
      height: 14,
    };
    this.signingFields.push(dateField);
    this.y -= 20;

    return field;
  }

  /**
   * Draw the landlord signature (pre-filled, not a field).
   */
  drawLandlordSignature(sigImage: PDFImage | null) {
    this.ensureSpace(80);

    this.currentPage.drawText("LANDLORD:", {
      x: MARGIN_L,
      y: this.y,
      font: this.fontBold,
      size: 10,
      color: BLACK,
    });
    this.y -= 8;

    if (sigImage) {
      const dims = sigImage.scale(0.35);
      const sigW = Math.min(dims.width, 180);
      const sigH = (sigW / dims.width) * dims.height;
      this.currentPage.drawImage(sigImage, {
        x: MARGIN_L,
        y: this.y - sigH,
        width: sigW,
        height: sigH,
      });
      this.y -= sigH + 4;
    }

    // Signature line
    this.currentPage.drawLine({
      start: { x: MARGIN_L, y: this.y },
      end: { x: MARGIN_L + 220, y: this.y },
      thickness: 0.75,
      color: BLACK,
    });
    this.y -= 14;

    this.currentPage.drawText("Makada Properties", {
      x: MARGIN_L,
      y: this.y,
      font: this.fontBold,
      size: 10,
      color: BLACK,
    });
    this.y -= 14;

    this.currentPage.drawText(
      `Date: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
      {
        x: MARGIN_L,
        y: this.y,
        font: this.font,
        size: 9,
        color: BLACK,
      }
    );
    this.y -= 24;
  }

  getSigningFields() {
    return this.signingFields;
  }

  getPageCount() {
    return this.pages.length;
  }

  finalize() {
    // Add page number to last page
    this.addPageNumber();
  }
}

/**
 * Generate a full residential lease agreement as a PDF.
 *
 * @param input  Lease field values
 * @param embedLandlordSig  Whether to embed the landlord's pre-signed signature
 * @returns PDF buffer, signing field metadata, and page count
 */
export async function generateLeasePdf(
  input: LeaseInput,
  embedLandlordSig = true
): Promise<LeaseGenerationResult> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Residential Lease Agreement — Makada Properties");
  pdf.setAuthor("Makada Properties");

  const writer = new PdfWriter(pdf);
  await writer.init();

  const fullAddress = formatAddressWithUnit(
    input.PROPERTY_ADDRESS,
    input.UNIT_NUMBER
  );
  const isSingleTenant = !input.TENANT_2_NAME?.trim();
  const tenantNames = isSingleTenant
    ? input.TENANT_1_NAME
    : `${input.TENANT_1_NAME} and ${input.TENANT_2_NAME}`;

  // Load landlord signature
  let landlordSigImage: PDFImage | null = null;
  if (embedLandlordSig) {
    try {
      const sigBuffer = fs.readFileSync(LANDLORD_SIG_PATH);
      try {
        landlordSigImage = await pdf.embedPng(sigBuffer);
      } catch {
        try {
          landlordSigImage = await pdf.embedJpg(sigBuffer);
        } catch {
          /* skip */
        }
      }
    } catch {
      /* No signature file */
    }
  }

  // ================================================================
  // HEADER
  // ================================================================
  writer.drawTitle("RESIDENTIAL LEASE AGREEMENT");
  writer.drawSubtitle("Makada Properties · 303 Lakeview Way, Emerald Hills, CA 94062");
  writer.drawLine();
  writer.drawSpace(4);

  // ================================================================
  // PARTIES
  // ================================================================
  writer.drawSectionHeader("1", "PARTIES");
  writer.drawParagraph(
    `This Residential Lease Agreement ("Lease") is entered into as of ${input.EFFECTIVE_DATE || input.START_DATE}, between:`
  );
  writer.drawBoldParagraph(
    `LANDLORD: Makada Properties, 303 Lakeview Way, Emerald Hills, CA 94062`
  );
  writer.drawBoldParagraph(`TENANT: ${tenantNames}`);
  writer.drawParagraph(
    `Landlord and Tenant are collectively referred to herein as the "Parties." Landlord agrees to lease to Tenant and Tenant agrees to rent from Landlord the premises described below, subject to the terms and conditions set forth in this Lease.`
  );

  // ================================================================
  // PREMISES
  // ================================================================
  writer.drawSectionHeader("2", "PREMISES");
  writer.drawParagraph(
    `Landlord hereby leases to Tenant the residential property located at ${fullAddress} (the "Premises"). The Premises consists of ${input.BEDROOM_COUNT} bedroom(s) and ${input.BATHROOM_COUNT} bathroom(s).`
  );
  if (input.PARKING_SPACE) {
    writer.drawParagraph(
      `Parking: ${input.PARKING_SPACE}.`
    );
  }
  if (input.STORAGE_DESCRIPTION) {
    writer.drawParagraph(
      `Storage: ${input.STORAGE_DESCRIPTION}.`
    );
  }

  // Initials field for premises
  writer.drawInitialsField("initials-premises", "Premises acknowledged");

  // ================================================================
  // TERM
  // ================================================================
  writer.drawSectionHeader("3", "TERM");
  writer.drawParagraph(
    `The lease term shall commence on ${input.START_DATE} and shall terminate on ${input.END_DATE} (the "Lease Term"). Upon expiration of the Lease Term, this Lease shall automatically convert to a month-to-month tenancy under the same terms and conditions, unless either party gives at least thirty (30) days' written notice of intent to terminate prior to the end of any monthly period.`
  );

  // ================================================================
  // RENT
  // ================================================================
  writer.drawSectionHeader("4", "RENT");
  writer.drawParagraph(
    `Tenant agrees to pay Landlord monthly rent in the amount of ${input.RENT_AMOUNT} per month, due and payable on the first (1st) day of each calendar month. Rent shall be paid via check, electronic transfer, or such other method as Landlord may designate.`
  );
  writer.drawParagraph(
    `Late Payment: If rent is not received by the fifth (5th) day of the month, Tenant shall pay a late charge of five percent (5%) of the monthly rent amount. If any check is returned for insufficient funds, Tenant shall pay an additional fee of $25.00.`
  );

  // Initials field for rent
  writer.drawInitialsField("initials-rent", "Rent terms acknowledged");

  // ================================================================
  // SECURITY DEPOSIT
  // ================================================================
  writer.drawSectionHeader("5", "SECURITY DEPOSIT");
  writer.drawParagraph(
    `Upon execution of this Lease, Tenant shall deposit with Landlord the sum of ${input.SECURITY_DEPOSIT} as a security deposit. The security deposit shall be held by Landlord as security for the faithful performance by Tenant of all terms, covenants, and conditions of this Lease.`
  );
  writer.drawParagraph(
    `The security deposit, or any portion thereof, may be applied by Landlord to: (a) unpaid rent; (b) repair of damages caused by Tenant beyond normal wear and tear; (c) cleaning costs to restore the Premises to its condition at the commencement of the Lease; and (d) any other amounts Tenant owes under this Lease. The security deposit shall be returned to Tenant within twenty-one (21) days after Tenant has vacated the Premises, less any lawful deductions, accompanied by an itemized statement.`
  );

  // Initials field for security deposit
  writer.drawInitialsField("initials-deposit", "Security deposit terms acknowledged");

  // ================================================================
  // UTILITIES
  // ================================================================
  writer.drawSectionHeader("6", "UTILITIES AND SERVICES");
  writer.drawParagraph(
    `Tenant shall be responsible for payment of all utilities and services to the Premises, including but not limited to electricity, gas, water, sewer, garbage collection, internet, cable, and telephone, unless otherwise specified in writing by Landlord. Landlord shall not be liable for any interruption or failure of utility services.`
  );

  // ================================================================
  // USE OF PREMISES
  // ================================================================
  writer.drawSectionHeader("7", "USE OF PREMISES");
  writer.drawParagraph(
    `The Premises shall be used and occupied by Tenant exclusively as a private residential dwelling for Tenant and Tenant's immediate family. Tenant shall not use or permit the use of the Premises for any unlawful purpose, nor shall Tenant cause or permit any nuisance in, on, or about the Premises. Tenant shall comply with all applicable laws, regulations, and ordinances affecting the Premises.`
  );

  // ================================================================
  // MAINTENANCE AND REPAIRS
  // ================================================================
  writer.drawSectionHeader("8", "MAINTENANCE AND REPAIRS");
  writer.drawParagraph(
    `Tenant shall maintain the Premises in a clean, sanitary, and good condition at all times. Tenant shall promptly notify Landlord of any maintenance issues, defects, or damage to the Premises. Tenant shall not make any alterations, additions, or improvements to the Premises without the prior written consent of Landlord. Landlord shall be responsible for repairs to the structure, plumbing, heating, electrical systems, and appliances furnished by Landlord, provided that such repairs are not necessitated by Tenant's misuse or negligence.`
  );

  // Initials field for maintenance
  writer.drawInitialsField("initials-maintenance", "Maintenance terms acknowledged");

  // ================================================================
  // PETS
  // ================================================================
  writer.drawSectionHeader("9", "PETS");
  writer.drawParagraph(
    `No pets, animals, or livestock of any kind shall be kept in or about the Premises without the prior written consent of Landlord. If Landlord grants consent, Tenant may be required to pay an additional pet deposit and monthly pet rent as determined by Landlord. Service animals and emotional support animals with proper documentation are permitted in accordance with applicable law.`
  );

  // Initials field for pets
  writer.drawInitialsField("initials-pets", "Pet policy acknowledged");

  // ================================================================
  // ENTRY BY LANDLORD
  // ================================================================
  writer.drawSectionHeader("10", "ENTRY BY LANDLORD");
  writer.drawParagraph(
    `Landlord or Landlord's agent may enter the Premises upon reasonable notice to Tenant (not less than 24 hours) for the purposes of: (a) making necessary or agreed repairs, decorations, alterations, or improvements; (b) supplying necessary or agreed services; (c) exhibiting the Premises to prospective or actual purchasers, mortgagees, tenants, workers, or contractors; or (d) when Tenant has abandoned or surrendered the Premises. In case of emergency, Landlord may enter the Premises without prior notice.`
  );

  // ================================================================
  // INSURANCE
  // ================================================================
  writer.drawSectionHeader("11", "RENTER'S INSURANCE");
  writer.drawParagraph(
    `Tenant is strongly encouraged to obtain renter's insurance to cover personal belongings and liability. Landlord's insurance does not cover Tenant's personal property. Landlord shall not be liable for any damage to or loss of Tenant's personal property arising from any cause whatsoever, including but not limited to theft, fire, water damage, or acts of God.`
  );

  // ================================================================
  // TERMINATION
  // ================================================================
  writer.drawSectionHeader("12", "TERMINATION AND SURRENDER");
  writer.drawParagraph(
    `Upon termination of this Lease, Tenant shall surrender the Premises in the same condition as received, reasonable wear and tear excepted. All personal property not removed by Tenant upon termination shall be considered abandoned. Tenant shall return all keys and access devices to Landlord on or before the date of termination.`
  );

  // ================================================================
  // GOVERNING LAW
  // ================================================================
  writer.drawSectionHeader("13", "GOVERNING LAW");
  writer.drawParagraph(
    `This Lease shall be governed by and construed in accordance with the laws of the State of California. Any disputes arising under or in connection with this Lease shall be resolved in the courts of San Mateo County, California.`
  );

  // ================================================================
  // ENTIRE AGREEMENT
  // ================================================================
  writer.drawSectionHeader("14", "ENTIRE AGREEMENT");
  writer.drawParagraph(
    `This Lease constitutes the entire agreement between the Parties concerning the subject matter hereof, and supersedes all prior and contemporaneous agreements, understandings, negotiations, and discussions, whether oral or written. No amendment or modification of this Lease shall be valid or binding unless set forth in writing and signed by both Parties.`
  );

  // Initials field for entire agreement
  writer.drawInitialsField("initials-agreement", "Full agreement acknowledged");

  // ================================================================
  // ADDITIONAL TERMS
  // ================================================================
  writer.drawSectionHeader("15", "ADDITIONAL TERMS");
  writer.drawParagraph(
    `(a) Quiet Enjoyment: Landlord warrants that Tenant shall have quiet and peaceful enjoyment of the Premises during the Lease Term, provided Tenant complies with all terms of this Lease.`
  );
  writer.drawParagraph(
    `(b) Notices: All notices required or permitted under this Lease shall be in writing and shall be deemed given when personally delivered or when sent by certified mail, return receipt requested, to the addresses specified herein.`
  );
  writer.drawParagraph(
    `(c) Severability: If any provision of this Lease is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.`
  );
  writer.drawParagraph(
    `(d) Waiver: The failure of either Party to enforce any provision of this Lease shall not be construed as a waiver of such provision or the right to enforce it at a later time.`
  );

  writer.drawSpace(10);
  writer.drawLine();
  writer.drawSpace(10);

  // ================================================================
  // SIGNATURES
  // ================================================================
  writer.drawSectionHeader("", "SIGNATURES");
  writer.drawParagraph(
    `IN WITNESS WHEREOF, the Parties have executed this Residential Lease Agreement as of the date first written above.`
  );
  writer.drawSpace(10);

  // Landlord signature (pre-filled)
  writer.drawLandlordSignature(landlordSigImage);
  writer.drawSpace(10);

  // Tenant signature field (to be signed)
  writer.drawSignatureField(
    "tenant-signature",
    input.TENANT_1_NAME,
    "TENANT:"
  );

  // Second tenant if applicable
  if (!isSingleTenant) {
    writer.drawSpace(6);
    writer.drawSignatureField(
      "tenant2-signature",
      input.TENANT_2_NAME,
      "TENANT 2:"
    );
  }

  // Footer note
  writer.drawSpace(16);
  writer.drawParagraph(
    `This lease was generated electronically by Makada Properties. Electronic signatures are legally binding under the Uniform Electronic Transactions Act (UETA) and the federal ESIGN Act.`,
    8
  );

  writer.finalize();

  const pdfBytes = await pdf.save();

  return {
    pdfBuffer: Buffer.from(pdfBytes),
    signingFields: writer.getSigningFields(),
    pageCount: writer.getPageCount(),
  };
}

/**
 * Embed tenant signatures and initials into an existing lease PDF.
 * Called after the tenant completes signing on the tenant portal.
 *
 * @param pdfBuffer  The original lease PDF
 * @param signatureImage  PNG buffer of the tenant's signature
 * @param initialsImage  PNG buffer of the tenant's initials
 * @param fields  The signing fields with their coordinates
 * @returns The signed PDF buffer
 */
export async function embedSignaturesIntoPdf(
  pdfBuffer: Buffer,
  signatureImage: Buffer,
  initialsImage: Buffer | null,
  fields: SigningField[]
): Promise<Buffer> {
  const pdf = await PDFDocument.load(pdfBuffer);
  const pages = pdf.getPages();

  // Embed images
  let sigImg: PDFImage;
  try {
    sigImg = await pdf.embedPng(signatureImage);
  } catch {
    sigImg = await pdf.embedJpg(signatureImage);
  }

  let initImg: PDFImage | null = null;
  if (initialsImage) {
    try {
      initImg = await pdf.embedPng(initialsImage);
    } catch {
      try {
        initImg = await pdf.embedJpg(initialsImage);
      } catch {
        /* skip */
      }
    }
  }

  const sigDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const font = await pdf.embedFont(StandardFonts.TimesRoman);

  for (const field of fields) {
    if (field.page >= pages.length) continue;
    const page = pages[field.page];

    if (field.type === "signature" && sigImg) {
      // Scale signature to fit the field
      const dims = sigImg.scale(1);
      const scale = Math.min(
        (field.width - 20) / dims.width,
        (field.height - 16) / dims.height
      );
      const w = dims.width * scale;
      const h = dims.height * scale;

      // Clear the field area (draw white rect)
      page.drawRectangle({
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        color: rgb(1, 1, 1),
        borderColor: FIELD_BORDER,
        borderWidth: 1,
      });

      // Draw signature centered in the field
      page.drawImage(sigImg, {
        x: field.x + (field.width - w) / 2,
        y: field.y + (field.height - h) / 2,
        width: w,
        height: h,
      });

      // Draw line at bottom
      page.drawLine({
        start: { x: field.x + 10, y: field.y + 10 },
        end: { x: field.x + field.width - 10, y: field.y + 10 },
        thickness: 0.5,
        color: BLACK,
      });
    } else if (field.type === "initials" && initImg) {
      const dims = initImg.scale(1);
      const scale = Math.min(
        (field.width - 8) / dims.width,
        (field.height - 6) / dims.height
      );
      const w = dims.width * scale;
      const h = dims.height * scale;

      // Clear and draw
      page.drawRectangle({
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        color: rgb(1, 1, 1),
        borderColor: FIELD_BORDER,
        borderWidth: 1,
      });

      page.drawImage(initImg, {
        x: field.x + (field.width - w) / 2,
        y: field.y + (field.height - h) / 2,
        width: w,
        height: h,
      });
    } else if (field.type === "date") {
      // Write the date
      page.drawText(sigDate, {
        x: field.x,
        y: field.y + 2,
        font,
        size: 9,
        color: BLACK,
      });
    }
  }

  const pdfBytes = await pdf.save();
  return Buffer.from(pdfBytes);
}

/**
 * Generate a filename for the lease PDF.
 */
export function leasePdfFilename(input: LeaseInput): string {
  const tenantName = input.TENANT_1_NAME.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 40);
  const unit = input.UNIT_NUMBER || "unit";
  return `Lease_${tenantName}_Unit${unit.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
}
