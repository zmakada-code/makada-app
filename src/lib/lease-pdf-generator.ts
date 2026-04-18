/**
 * Lease PDF Generator
 *
 * Generates a professional multi-page California Residential Lease Agreement
 * as a PDF using pdf-lib, faithfully matching the original Makada Properties
 * lease template (58 sections + addendums).
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

// Page dimensions (US Letter)
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
    const w = this.fontBold.widthOfTextAtSize(text, 16);
    this.currentPage.drawText(text, {
      x: PAGE_W / 2 - w / 2,
      y: this.y,
      font: this.fontBold,
      size: 16,
      color: BLACK,
    });
    this.y -= 24;
  }

  drawSubtitle(text: string) {
    this.ensureSpace(20);
    const w = this.fontItalic.widthOfTextAtSize(text, 10);
    this.currentPage.drawText(text, {
      x: PAGE_W / 2 - w / 2,
      y: this.y,
      font: this.fontItalic,
      size: 10,
      color: MUTED,
    });
    this.y -= 16;
  }

  drawLine() {
    this.ensureSpace(10);
    this.currentPage.drawLine({
      start: { x: MARGIN_L, y: this.y },
      end: { x: PAGE_W - MARGIN_R, y: this.y },
      thickness: 0.75,
      color: LINE_COLOR,
    });
    this.y -= 10;
  }

  drawSectionHeader(text: string) {
    this.ensureSpace(26);
    this.y -= 6;
    this.currentPage.drawText(text, {
      x: MARGIN_L,
      y: this.y,
      font: this.fontBold,
      size: 10,
      color: BLACK,
    });
    this.y -= 16;
  }

  drawParagraph(text: string, fontSize = 9.5, indent = 0) {
    const lines = wrapText(text, this.font, fontSize, CONTENT_W - indent);
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
    this.y -= 3;
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
    this.y -= 3;
  }

  drawBoldLine(text: string, fontSize = 9.5) {
    this.ensureSpace(fontSize + 6);
    this.currentPage.drawText(text, {
      x: MARGIN_L,
      y: this.y,
      font: this.fontBold,
      size: fontSize,
      color: BLACK,
    });
    this.y -= fontSize + 5;
  }

  drawTextLine(text: string, fontSize = 9.5, indent = 0) {
    this.ensureSpace(fontSize + 6);
    this.currentPage.drawText(text, {
      x: MARGIN_L + indent,
      y: this.y,
      font: this.font,
      size: fontSize,
      color: BLACK,
    });
    this.y -= fontSize + 5;
  }

  drawSpace(h: number) {
    this.y -= h;
  }

  drawInitialsField(fieldId: string, label: string): SigningField {
    this.ensureSpace(28);
    const fieldW = 80;
    const fieldH = 22;
    const fieldX = PAGE_W - MARGIN_R - fieldW;
    const fieldY = this.y - fieldH + 4;

    this.currentPage.drawRectangle({
      x: fieldX,
      y: fieldY,
      width: fieldW,
      height: fieldH,
      borderColor: FIELD_BORDER,
      borderWidth: 1,
      color: FIELD_BG,
    });

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

    this.currentPage.drawText(signerLabel, {
      x: MARGIN_L,
      y: this.y + 2,
      font: this.fontBold,
      size: 10,
      color: BLACK,
    });
    this.y -= 4;

    this.currentPage.drawRectangle({
      x: fieldX,
      y: fieldY,
      width: fieldW,
      height: fieldH,
      borderColor: FIELD_BORDER,
      borderWidth: 1.5,
      color: FIELD_BG,
    });

    this.currentPage.drawText("Sign here", {
      x: fieldX + fieldW / 2 - 20,
      y: fieldY + fieldH / 2 - 4,
      font: this.fontItalic,
      size: 9,
      color: MUTED,
    });

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

    this.currentPage.drawText(`Name: ${label}`, {
      x: MARGIN_L,
      y: this.y,
      font: this.font,
      size: 9,
      color: BLACK,
    });
    this.y -= 14;

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

  drawLandlordSignature(sigImage: PDFImage | null) {
    this.ensureSpace(80);

    this.currentPage.drawText("LANDLORD:", {
      x: MARGIN_L,
      y: this.y,
      font: this.fontBold,
      size: 10,
      color: BLACK,
    });
    this.y -= 4;

    this.currentPage.drawText("By:", {
      x: MARGIN_L,
      y: this.y,
      font: this.font,
      size: 9,
      color: BLACK,
    });
    this.y -= 4;

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

    const today = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    this.currentPage.drawText(`Date: ${today}`, {
      x: MARGIN_L,
      y: this.y,
      font: this.font,
      size: 9,
      color: BLACK,
    });
    this.y -= 24;
  }

  getSigningFields() {
    return this.signingFields;
  }

  getPageCount() {
    return this.pages.length;
  }

  finalize() {
    this.addPageNumber();
  }
}

/**
 * Generate the full California Residential Lease Agreement as a PDF,
 * matching the original Makada Properties lease template.
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

  const isSingleTenant = !input.TENANT_2_NAME?.trim();
  const tenantNames = isSingleTenant
    ? input.TENANT_1_NAME
    : `${input.TENANT_1_NAME} and ${input.TENANT_2_NAME}`;

  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

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
  writer.drawSubtitle("California");
  writer.drawTitle("Residential Lease Agreement");
  writer.drawLine();
  writer.drawSpace(4);

  // ================================================================
  // PREAMBLE
  // ================================================================
  writer.drawParagraph(
    `This Lease Agreement (the "Agreement") is made and entered on ${today} (the "Effective Date") by and between Makada Properties (the "Landlord") and the following tenants:`
  );
  writer.drawBoldLine(`Tenant 1: ${input.TENANT_1_NAME}`);
  if (!isSingleTenant) {
    writer.drawBoldLine(`Tenant 2: ${input.TENANT_2_NAME}`);
  }
  writer.drawParagraph(`(the "Tenant")`);
  writer.drawParagraph(
    `Subject to the terms and conditions stated below the parties agree as follows:`
  );

  // ================================================================
  // 1. PREMISES
  // ================================================================
  writer.drawSectionHeader(
    `1. PREMISES.`
  );
  writer.drawParagraph(
    `Landlord, in consideration of the lease payments provided in this Lease, leases to Tenant the following: ${input.BEDROOM_COUNT} Bedroom, ${input.BATHROOM_COUNT} Bath Apartment (the "Premises") located at ${input.PROPERTY_ADDRESS}, Unit ${input.UNIT_NUMBER}.`
  );
  writer.drawInitialsField("initials-premises", "Premises acknowledged");

  // ================================================================
  // 2. TERM
  // ================================================================
  writer.drawSectionHeader(`2. TERM.`);
  writer.drawParagraph(
    `This Agreement will begin on Start Date ${input.START_DATE} (the "Start Date") and will terminate on End Date ${input.END_DATE} (the "Termination Date"), and thereafter will be month-to-month on the same terms and conditions as this Lease, unless and until either party gives written notice of termination no less than 30 days prior to the end of the current rental month.`
  );

  // ================================================================
  // 3. RENT; LEASE PAYMENTS
  // ================================================================
  writer.drawSectionHeader(`3. RENT; LEASE PAYMENTS.`);
  writer.drawParagraph(
    `"Rent" shall mean all monetary obligations of Tenant to Landlord under the terms of this Agreement, except the Security Deposit.`
  );
  writer.drawParagraph(
    `(a) Tenant shall pay to Landlord initial monthly base lease payments of Rent Amount: ${input.RENT_AMOUNT}, payable in advance on the first day of each calendar month, and is delinquent on the next day. Landlord may, at their sole discretion, prorate rent for any partial month.`
  );
  writer.drawParagraph(`(b) Rent shall be paid by the following method(s):`);
  writer.drawTextLine(`Cash`, 9.5, 16);
  writer.drawTextLine(`Money Order`, 9.5, 16);
  writer.drawTextLine(`Cashier's Check`, 9.5, 16);
  writer.drawTextLine(`Makada Properties Website`, 9.5, 16);
  writer.drawParagraph(
    `If any payment is returned for non-sufficient funds or because Tenant stops payments, then, after that, (i) Landlord may, in writing, require Tenant to pay Rent in cash for three months and (ii) all future Rent must be made by certified funds.`
  );
  writer.drawParagraph(
    `In the event of roommates, or another form of joint or multiple occupancy, Tenant will be responsible for collecting payment from all parties and submitting a single payment to Landlord. Tenant is responsible for any payment made by mail and not received by the due date stated herein. Mailed lease payments must be received on or before the due date. Lease payments for any partial month will be prorated.`
  );
  writer.drawParagraph(
    `Landlord may apply any payment made by Tenant to any obligation owed by Tenant to Landlord regardless of any dates or directions provided by the Tenant that accompanies a payment. Landlord has full discretion over how payments are applied.`
  );
  writer.drawInitialsField("initials-rent", "Rent terms acknowledged");

  // ================================================================
  // 4. SECURITY DEPOSIT
  // ================================================================
  writer.drawSectionHeader(`4. SECURITY DEPOSIT.`);
  writer.drawParagraph(
    `At the time of the signing of this Lease, Tenant shall pay Landlord a security deposit of ${input.SECURITY_DEPOSIT} (the "Security Deposit") for the purposes of ensuring the faithful performance of all lease obligations.`
  );
  writer.drawParagraph(
    `Landlord may apply all or a portion of the Security Deposit as allowed by law including, but not limited to, (i) Tenant's obligation to restore, replace or return personal property, (ii) cure Tenant's default in the payment of Rent, late charges, or other sums owed, (iii) repair of damages caused by Tenant beyond normal wear and tear, (iv) cleaning of the Premises upon termination.`
  );
  writer.drawParagraph(
    `The balance of the Security Deposit and any unpaid accrued interest, if any, along with full accounting will be mailed to the Tenant at the forwarding address provided to the Landlord. If no forwarding address is provided, the deposit will be mailed to the Premises.`
  );
  writer.drawParagraph(
    `Landlord may increase the security deposit at any time without notice up to the maximum allowed by law. Landlord and Tenant agree that the Security Deposit is not rent and therefore not subject to the same requirements as rental payments.`
  );
  writer.drawParagraph(
    `Upon the vacating of the Premises for termination of the lease, Landlord shall have twenty-one (21) days to return the security deposit to Tenant, minus any deductions for damages or other charges, together with an itemized statement of deductions.`
  );
  writer.drawInitialsField("initials-deposit", "Security deposit terms acknowledged");

  // ================================================================
  // 5. POSSESSION
  // ================================================================
  writer.drawSectionHeader(`5. POSSESSION.`);
  writer.drawParagraph(
    `Tenant shall be entitled to possession on the first day of the term of this Lease, and shall yield possession to Landlord on the last day of the term of this Lease, unless otherwise agreed to in writing.`
  );

  // ================================================================
  // 6. USE OF PREMISES/ABSENCES
  // ================================================================
  writer.drawSectionHeader(`6. USE OF PREMISES/ABSENCES.`);
  writer.drawParagraph(
    `Tenant shall occupy and use the Premises as a full-time residential dwelling unit. Tenant shall notify Landlord of any anticipated extended absence from the Premises not later than the first day of the extended absence.`
  );
  writer.drawParagraph(
    `No retail, commercial or professional use of the Premises is allowed unless the Tenant receives prior written consent of the Landlord and such use conforms to applicable zoning laws.`
  );

  // ================================================================
  // 7. SMOKING
  // ================================================================
  writer.drawSectionHeader(`7. SMOKING.`);
  writer.drawParagraph(
    `Smoking is prohibited in any area in or on the Premises and on the Property, both private and common, whether enclosed or outdoors. This policy applies to all owners, tenants, guests, employees, and anyone else on the Property.`
  );
  writer.drawParagraph(
    `Notwithstanding any law to the contrary, the growing, cultivation, sale, or use in any form, of marijuana, for any purpose, is not permitted in or about the Premises, at any time, by Tenant, or Tenant's guests.`
  );
  writer.drawParagraph(
    `The failure to abide by the provisions of this section shall constitute a material breach of this Agreement and is a just cause for eviction.`
  );

  // ================================================================
  // 8. MANAGEMENT
  // ================================================================
  writer.drawSectionHeader(`8. MANAGEMENT.`);
  writer.drawParagraph(
    `The Tenant is hereby notified that Makada Properties is the property manager in charge of the Property. Should the tenant have any issues or concerns the Tenant may contact Makada Properties at 533 Airport Blvd., Suite 500, Burlingame, California 94010.`
  );

  // ================================================================
  // 9. OCCUPANTS
  // ================================================================
  writer.drawSectionHeader(`9. OCCUPANTS.`);
  writer.drawParagraph(
    `No more than 2 person(s) may reside on the Premises unless the prior written consent of the Landlord is obtained.`
  );
  writer.drawParagraph(
    `This Lease and occupancy of the Premises is binding, individually and severally, on each person(s) specifically named and who signs this Lease, regardless of the named person's occupancy of the Premises.`
  );
  writer.drawBoldLine(`Authorized Tenants/Occupants:`);
  writer.drawTextLine(`Tenant 1: ${input.TENANT_1_NAME}`);
  if (!isSingleTenant) {
    writer.drawTextLine(`Tenant 2: ${input.TENANT_2_NAME}`);
  }
  writer.drawParagraph(
    `Tenant may have guests on the Premises for not over 3 consecutive days or 15 days in a calendar year, and no more than two guests per bedroom at any one time. Persons staying more than 3 consecutive days may be considered occupants and must be approved by Landlord.`
  );

  // ================================================================
  // 10. WATERBEDS
  // ================================================================
  writer.drawSectionHeader(`10. WATERBEDS.`);
  writer.drawParagraph(
    `Waterbeds and/or liquid filled furniture are PROHIBITED in accordance with Civil Code Section 1940.5. If the Premises are located in a structure with an original Certificate of Occupancy issued after January 1, 1973, Tenant may use a waterbed provided Tenant maintains waterbed insurance.`
  );

  // ================================================================
  // 11. KEYS
  // ================================================================
  writer.drawSectionHeader(`11. KEYS.`);
  writer.drawParagraph(
    `Tenant will be given 2 key(s) to the Premises and 1 mailbox key(s). If all keys are not returned to Landlord following termination of the Lease, Tenant shall be charged $20.00. Tenant is not permitted to change any lock or place additional locking devices on any door or window of the Premises without Landlord's approval prior to installation. If allowed, Tenant must provide Landlord with keys to any new locks.`
  );

  // ================================================================
  // 12. LOCKOUT
  // ================================================================
  writer.drawSectionHeader(`12. LOCKOUT.`);
  writer.drawParagraph(
    `If Tenant becomes locked out of the Premises, Tenant will be charged $50.00 to regain entry.`
  );

  // ================================================================
  // 13. STORAGE
  // ================================================================
  writer.drawSectionHeader(`13. STORAGE.`);
  writer.drawParagraph(
    `During the term of this Lease, tenant shall be entitled to store items of personal property in ${input.STORAGE_DESCRIPTION || "the storage room behind parking spot"}. Landlord shall not be liable for loss of, or damage to, any stored items.`
  );

  // ================================================================
  // 14. ROOF/FIRE ESCAPES
  // ================================================================
  writer.drawSectionHeader(`14. ROOF/FIRE ESCAPES.`);
  writer.drawParagraph(
    `Use of the roof and/or the fire escapes by Tenants and/or guests is limited to emergency use only. No other use is permitted, including but not limited to, the placement of personal property, furniture, or equipment on the roof or fire escapes.`
  );

  // ================================================================
  // 15. PARKING
  // ================================================================
  writer.drawSectionHeader(`15. PARKING.`);
  writer.drawParagraph(
    `Parking is permitted as follows: tenant shall be entitled to use 1 parking space(s) for the parking of motor vehicle(s). The parking space(s) provided are identified as ${input.PARKING_SPACE || "As assigned by management"}. Any vehicle parked in an unauthorized space may be towed at the vehicle owner's expense.`
  );

  // ================================================================
  // 16. MAINTENANCE
  // ================================================================
  writer.drawSectionHeader(`16. MAINTENANCE.`);
  writer.drawParagraph(
    `Landlord shall have the responsibility to maintain the Premises in reasonably good repair at all times and perform all repairs reasonably necessary to satisfy any implied warranty of habitability. Landlord shall not be responsible for damages caused by Tenant's misuse, waste, or neglect.`
  );
  writer.drawParagraph(
    `Except in an emergency, all maintenance and repair requests must be made in writing and delivered to Landlord or its Agent. A repair request will be deemed permission for the Landlord or its Agent to enter the Premises to make the requested repair.`
  );
  writer.drawParagraph(
    `Tenant acknowledges that the Premises and the building from time to time may require renovations or repairs to keep them in good condition and repair and that such work may result in temporary loss of some services. Landlord shall use reasonable efforts to minimize inconvenience.`
  );
  writer.drawParagraph(
    `Tenant shall properly use, operate and safeguard Premises, including if applicable, any landscaping, furniture, furnishings, and appliances, and all mechanical, electrical, gas and plumbing fixtures, and keep them clean and sanitary.`
  );
  writer.drawInitialsField("initials-maintenance", "Maintenance terms acknowledged");

  // ================================================================
  // 17. UTILITIES AND SERVICES
  // ================================================================
  writer.drawSectionHeader(`17. UTILITIES AND SERVICES.`);
  writer.drawParagraph(
    `Tenant shall be responsible for all utilities and services (gas and electric) incurred in connection with the Premises. Tenant agrees to comply with any environmental, waste management, or conservation requirements imposed by applicable law or utility provider.`
  );
  writer.drawParagraph(
    `Landlord shall not be liable to Tenant or to any other person in damages or otherwise, nor shall it be considered a default under this Lease for any interruption or reduction of utilities or services.`
  );

  // ================================================================
  // 18. TAXES
  // ================================================================
  writer.drawSectionHeader(`18. TAXES.`);
  writer.drawParagraph(
    `Taxes attributable to the Premises or the use of the Premises shall be allocated as follows: REAL ESTATE TAXES. Landlord shall pay all real estate taxes and assessments for the Premises.`
  );
  writer.drawParagraph(
    `PERSONAL PROPERTY TAXES. Landlord shall pay all personal property taxes and any other charges which may be levied against the Premises which are attributable to Tenant's use of the Premises, along with any taxes on Tenant's personal property.`
  );

  // ================================================================
  // 19. PROPERTY INSURANCE
  // ================================================================
  writer.drawSectionHeader(`19. PROPERTY INSURANCE.`);
  writer.drawParagraph(
    `Landlord and Tenant shall each be responsible to maintain appropriate insurance for their respective interests in the Premises and property located on the Premises.`
  );

  // ================================================================
  // 20. OTHER
  // ================================================================
  writer.drawSectionHeader(`20. OTHER.`);
  writer.drawParagraph(
    `Lease/Rental Mold Ventilation Addendum is Attached.`
  );

  // ================================================================
  // 21. NON-SUFFICIENT FUNDS
  // ================================================================
  writer.drawSectionHeader(`21. NON-SUFFICIENT FUNDS.`);
  writer.drawParagraph(
    `Tenant will be charged a monetary fee of $25.00 as reimbursement of the expenses incurred by Landlord for the first check that is returned to Landlord for lack of sufficient funds. Landlord reserves the right to demand future rent payments by cashier's check, money order or certified funds in the event a check is returned for insufficient funds.`
  );

  // ================================================================
  // 22. LATE PAYMENTS
  // ================================================================
  writer.drawSectionHeader(`22. LATE PAYMENTS.`);
  writer.drawParagraph(
    `Tenant and Landlord agree that Landlord will incur costs and damage as a result of any late payment of lease payments. Due to the difficulty involved in assessing the exact amount of damages, if any installment of rent is not received within 5 days of due date, Tenant shall pay a late charge equal to 5% of the monthly rent amount.`
  );
  writer.drawParagraph(
    `This provision for payment of a late charge does not constitute a grace period and Landlord may serve a 3-Day Notice to Pay Rent or Quit on the day after due. Landlord and Tenant agree Tenant's payment of rent is not deemed received until funds clear the bank.`
  );

  // ================================================================
  // 23. FAILURE TO PAY
  // ================================================================
  writer.drawSectionHeader(`23. FAILURE TO PAY.`);
  writer.drawParagraph(
    `Pursuant to Civil Code Section 1785.26, you are hereby notified that a negative credit report reflecting on your credit record may be submitted to a credit reporting agency if you fail to fulfill the terms of your credit obligations.`
  );

  // ================================================================
  // 24. DEFAULTS
  // ================================================================
  writer.drawSectionHeader(`24. DEFAULTS.`);
  writer.drawParagraph(
    `Tenant shall be in default of this Lease if Tenant fails to fulfill any lease obligation or term by which Tenant is bound. Subject to any governing provisions of law to the contrary, if Tenant fails to cure any financial obligation within 5 days or any other obligation within 10 days after written notice, Landlord may take possession pursuant to applicable law.`
  );

  // ================================================================
  // 25. EARLY TERMINATION CLAUSE
  // ================================================================
  writer.drawSectionHeader(`25. EARLY TERMINATION CLAUSE.`);
  writer.drawParagraph(
    `Tenant may, upon 30 days' written notice to Landlord, terminate this lease provided that the Tenant pays a termination charge equal to $5,200.00 or the maximum allowable by law, whichever is less.`
  );

  // ================================================================
  // 26. MILITARY TERMINATION CLAUSE
  // ================================================================
  writer.drawSectionHeader(`26. MILITARY TERMINATION CLAUSE.`);
  writer.drawParagraph(
    `In the event the Tenant is, or hereafter becomes, a member of the United States Armed Forces on extended active duty and hereafter the Tenant receives permanent change of station orders to depart from the area, Tenant may terminate this Lease upon 30 days' written notice.`
  );

  // ================================================================
  // 27. HABITABILITY
  // ================================================================
  writer.drawSectionHeader(`27. HABITABILITY.`);
  writer.drawParagraph(
    `Tenant has inspected the Premises and fixtures (or has had the Premises inspected on behalf of Tenant), and acknowledges that the Premises are in a reasonable and acceptable condition of habitability for their intended use, and the agreed lease payments are fair and reasonable.`
  );

  // ================================================================
  // 28. HOLDOVER
  // ================================================================
  writer.drawSectionHeader(`28. HOLDOVER.`);
  writer.drawParagraph(
    `If Tenant maintains possession of the Premises for any period after the termination of this Lease ("Holdover Period"), Tenant shall pay to Landlord lease payment(s) during the Holdover Period at a rate equal to 150% of the most recent rent, and such tenancy shall be construed as a month-to-month tenancy.`
  );

  // ================================================================
  // 29. CUMULATIVE RIGHTS
  // ================================================================
  writer.drawSectionHeader(`29. CUMULATIVE RIGHTS.`);
  writer.drawParagraph(
    `The rights of the parties under this Lease are cumulative, and shall not be construed as exclusive unless otherwise required by law.`
  );

  // ================================================================
  // 30. REMODELING OR STRUCTURAL IMPROVEMENTS
  // ================================================================
  writer.drawSectionHeader(`30. REMODELING OR STRUCTURAL IMPROVEMENTS.`);
  writer.drawParagraph(
    `Tenant shall be allowed to conduct construction or remodeling (at Tenant's expense) only with the prior written consent of the Landlord which shall not be unreasonably withheld. All alterations shall become the property of Landlord upon termination of this Lease unless Landlord requests removal.`
  );

  // ================================================================
  // 31. ACCESS BY LANDLORD TO PREMISES
  // ================================================================
  writer.drawSectionHeader(`31. ACCESS BY LANDLORD TO PREMISES.`);
  writer.drawParagraph(
    `Landlord shall have the right to enter the Premises pursuant to California Civil Code Section 1954 and to make inspections, provide necessary services, or show the Premises to prospective buyers, tenants, or lenders. Landlord shall provide reasonable notice (not less than 24 hours) except in cases of emergency.`
  );

  // ================================================================
  // 32. INDEMNITY REGARDING USE OF PREMISES
  // ================================================================
  writer.drawSectionHeader(`32. INDEMNITY REGARDING USE OF PREMISES.`);
  writer.drawParagraph(
    `To the extent permitted by law, Tenant agrees to indemnify, hold harmless, and defend Landlord from and against any and all losses, claims, liabilities, and expenses, including attorney's fees, arising from Tenant's use of the Premises or from any activity, work, or thing done, permitted, or suffered by Tenant.`
  );

  // ================================================================
  // 33. ACCOMMODATION
  // ================================================================
  writer.drawSectionHeader(`33. ACCOMMODATION.`);
  writer.drawParagraph(
    `Landlord agrees to and is committed to complying with all applicable laws providing equal housing opportunities. To ensure compliance, Landlord will make reasonable accommodations for known physical or mental disabilities of a Tenant. It is the Tenant's responsibility to make Landlord aware of any required accommodation.`
  );

  // ================================================================
  // 34. DANGEROUS MATERIALS
  // ================================================================
  writer.drawSectionHeader(`34. DANGEROUS MATERIALS.`);
  writer.drawParagraph(
    `Tenant shall not keep or have on the Premises any article or thing of a dangerous, flammable, or explosive character that might substantially increase the danger of fire on the Premises or that might be considered hazardous by any responsible insurance company.`
  );

  // ================================================================
  // 35. ASBESTOS
  // ================================================================
  writer.drawSectionHeader(`35. ASBESTOS.`);
  writer.drawParagraph(
    `The Premises may contain asbestos or have original construction materials that contain asbestos. Damaging or disturbing the surface of asbestos-containing materials may increase the risk of exposure. Therefore, Tenant and Tenant's guests, contractors or invitees shall not allow any action which may disturb existing asbestos-containing materials.`
  );

  // ================================================================
  // 36. COMPLIANCE WITH REGULATIONS
  // ================================================================
  writer.drawSectionHeader(`36. COMPLIANCE WITH REGULATIONS.`);
  writer.drawParagraph(
    `Tenant shall promptly comply with all laws, ordinances, requirements and regulations of the federal, state, county, municipal and other authorities, and the fire insurance underwriter applicable to the Premises.`
  );

  // ================================================================
  // 37. MECHANICS LIENS
  // ================================================================
  writer.drawSectionHeader(`37. MECHANICS LIENS.`);
  writer.drawParagraph(
    `Neither Tenant nor anyone claiming through the Tenant shall have the right to file mechanics liens or any other kind of lien on the Premises and the filing of this Lease constitutes notice thereof.`
  );

  // ================================================================
  // 38. SUBORDINATION OF LEASE
  // ================================================================
  writer.drawSectionHeader(`38. SUBORDINATION OF LEASE.`);
  writer.drawParagraph(
    `This Lease is subordinate to any mortgage that now exists, or may be given later by Landlord, with respect to the Premises.`
  );

  // ================================================================
  // 39. ASSIGNABILITY/SUBLETTING
  // ================================================================
  writer.drawSectionHeader(`39. ASSIGNABILITY/SUBLETTING.`);
  writer.drawParagraph(
    `Tenant may not assign or sublease any interest in the Premises, nor assign, mortgage or pledge this Lease. This is a blanket prohibition, meaning no replacement tenant(s) or subtenant(s) of any kind are allowed without the prior written consent of Landlord.`
  );

  // ================================================================
  // 40. INDIVIDUAL LIABILITY
  // ================================================================
  writer.drawSectionHeader(`40. INDIVIDUAL LIABILITY.`);
  writer.drawParagraph(
    `Each person who signs this agreement, whether or not said person is or remains in possession of the Premises, is jointly and severally responsible for the full performance of each and every obligation of this Lease.`
  );

  // ================================================================
  // 41. INSPECTION OF PREMISES
  // ================================================================
  writer.drawSectionHeader(`41. INSPECTION OF PREMISES.`);
  writer.drawParagraph(
    `Tenant has inspected the Premises, furnishings and equipment including smoke detectors, where applicable, and finds the Premises to be satisfactory and in good working order.`
  );

  // ================================================================
  // 42. NUISANCE
  // ================================================================
  writer.drawSectionHeader(`42. NUISANCE.`);
  writer.drawParagraph(
    `Tenant agrees not to commit, nor permit to be committed, any waste or nuisance, upon in or about the Premises, nor shall Tenant create or permit a substantial interference with the comfort, safety, or enjoyment of other tenants or neighbors.`
  );

  // ================================================================
  // 43. LEAD DISCLOSURE
  // ================================================================
  writer.drawSectionHeader(`43. LEAD DISCLOSURE.`);
  writer.drawParagraph(
    `Many homes and apartments built before 1978 have paint that contains lead (called lead-based paint). Lead from paint chips and dust can pose serious health hazards if not taken care of properly.`
  );

  // ================================================================
  // 44. MOLD/MILDEW
  // ================================================================
  writer.drawSectionHeader(`44. MOLD/MILDEW.`);
  writer.drawParagraph(
    `Tenant agrees to maintain the Premises in a manner that prevents the occurrence of, and infestation of mold or mildew in the Premises. Tenant agrees to uphold this responsibility in part by complying with the maintenance and ventilation terms of this lease and the attached Mold Addendum.`
  );

  // ================================================================
  // 45. NOTICE
  // ================================================================
  writer.drawSectionHeader(`45. NOTICE.`);
  writer.drawParagraph(
    `Notices under this Lease shall not be deemed valid unless given or served in writing and forwarded by mail, postage prepaid, addressed to the party at the appropriate address set forth below.`
  );
  writer.drawSpace(4);
  writer.drawBoldLine(`LANDLORD:`);
  writer.drawTextLine(`Makada Properties`);
  writer.drawTextLine(`533 Airport Blvd., Suite 500`);
  writer.drawTextLine(`Burlingame, California 94010`);
  writer.drawSpace(4);
  writer.drawBoldLine(`TENANT:`);
  writer.drawTextLine(`Tenant 1: ${input.TENANT_1_NAME}`);
  if (!isSingleTenant) {
    writer.drawTextLine(`Tenant 2: ${input.TENANT_2_NAME}`);
  }
  writer.drawTextLine(`Address of Property: ${input.PROPERTY_ADDRESS} Unit ${input.UNIT_NUMBER}`);
  writer.drawParagraph(
    `Such addresses may be changed from time to time by either party by providing notice as set forth above.`
  );

  // ================================================================
  // 46. HAZARDOUS MATERIALS DISCLOSURE
  // ================================================================
  writer.drawSectionHeader(`46. HAZARDOUS MATERIALS DISCLOSURE.`);
  writer.drawParagraph(
    `Pursuant to the regulations of Proposition 65, enacted by the voters of California, Landlord hereby makes the following required disclosure: Warning — The Premises may contain chemicals known to the State of California to cause cancer, birth defects, and other reproductive harm.`
  );

  // ================================================================
  // 47. MEGAN'S LAW
  // ================================================================
  writer.drawSectionHeader(`47. MEGAN'S LAW.`);
  writer.drawParagraph(
    `The California Department of Justice, sheriff's departments, police departments serving jurisdictions of 200,000 or more and many other local law enforcement authorities maintain for public access a database of the locations of persons required to register pursuant to Section 290.4 of the Penal Code. Notice: Pursuant to Section 290.46 of the Penal Code, information about specified registered sex offenders is made available to the public via an Internet Web site maintained by the Department of Justice at www.meganslaw.ca.gov.`
  );

  // ================================================================
  // 48. GOVERNING LAW
  // ================================================================
  writer.drawSectionHeader(`48. GOVERNING LAW.`);
  writer.drawParagraph(
    `This Lease shall be construed in accordance with the laws of the State of California.`
  );

  // ================================================================
  // 49. ENTIRE AGREEMENT/AMENDMENT
  // ================================================================
  writer.drawSectionHeader(`49. ENTIRE AGREEMENT/AMENDMENT.`);
  writer.drawParagraph(
    `This Lease contains the entire agreement of the parties and there are no other promises, conditions, understandings or other agreements, whether oral or written, relating to the subject matter of this Lease. This Lease may be modified or amended only in writing signed by the Parties.`
  );
  writer.drawInitialsField("initials-agreement", "Full agreement acknowledged");

  // ================================================================
  // 50. SEVERABILITY; WAIVER
  // ================================================================
  writer.drawSectionHeader(`50. SEVERABILITY; WAIVER.`);
  writer.drawParagraph(
    `If any portion of this Lease shall be held to be invalid or unenforceable for any reason, the remaining provisions shall continue to be valid and enforceable. The failure of either party to enforce any provision of this Lease shall not be construed as a waiver of such provision.`
  );

  // ================================================================
  // 51. TIME OF ESSENCE
  // ================================================================
  writer.drawSectionHeader(`51. TIME OF ESSENCE.`);
  writer.drawParagraph(
    `Time is of the essence with respect to the execution of this Lease.`
  );

  // ================================================================
  // 52. ESTOPPEL CERTIFICATE
  // ================================================================
  writer.drawSectionHeader(`52. ESTOPPEL CERTIFICATE.`);
  writer.drawParagraph(
    `Tenant shall execute and return a tenant estoppel certificate delivered to Tenant by Landlord or Landlord's agent within 3 days after its receipt. Failure to comply with this requirement shall be deemed Tenant's acknowledgment that the information contained in the estoppel certificate is true and correct.`
  );

  // ================================================================
  // 53. TENANT REPRESENTATION; CREDIT
  // ================================================================
  writer.drawSectionHeader(`53. TENANT REPRESENTATION; CREDIT.`);
  writer.drawParagraph(
    `Tenant represents and warrants that all statements in Tenant's rental application are accurate. Tenant authorizes Landlord and any broker to obtain Tenant's credit report periodically during the tenancy as allowed by law.`
  );

  // ================================================================
  // 54. BINDING EFFECT
  // ================================================================
  writer.drawSectionHeader(`54. BINDING EFFECT.`);
  writer.drawParagraph(
    `The provisions of this Lease shall be binding upon and inure to the benefit of both parties and their respective legal representatives, successors and assigns.`
  );

  // ================================================================
  // 55. DISPUTE RESOLUTION
  // ================================================================
  writer.drawSectionHeader(`55. DISPUTE RESOLUTION.`);
  writer.drawParagraph(
    `The parties will attempt to resolve any dispute arising out of or relating to this Agreement through friendly negotiations amongst the parties. If the matter is not resolved by negotiation, the parties agree to attempt to resolve the dispute through mediation before resorting to arbitration or litigation.`
  );

  // ================================================================
  // 56. NOTICE (VACATING)
  // ================================================================
  writer.drawSectionHeader(`56. NOTICE.`);
  writer.drawParagraph(
    `During the thirty (30) day period prior to Tenant's vacating of the Premises, Tenant agrees to reasonably cooperate with Landlord in allowing access to show the Premises to prospective tenants or buyers.`
  );

  // ================================================================
  // 57. APPLIANCES AND MAINTENANCE RESPONSIBILITY
  // ================================================================
  writer.drawSectionHeader(`57. APPLIANCES AND MAINTENANCE RESPONSIBILITY (TO BE INITIALED)`);
  writer.drawParagraph(
    `Tenant acknowledges responsibility for basic and routine maintenance of appliances and fixtures within the Premises, including but not limited to checking power supply, circuit breakers, filters, and basic troubleshooting before submitting a maintenance request to Landlord.`
  );
  writer.drawParagraph(
    `In the event Tenant requests maintenance service and the issue is determined by Landlord or its agent to be the result of Tenant's failure to perform basic maintenance, misuse, or a non-defective condition, Tenant may be charged a service call fee as determined by Landlord.`
  );
  writer.drawInitialsField("initials-appliances", "Appliance responsibility acknowledged");

  // ================================================================
  // 58. MOLD PREVENTION AND VENTILATION
  // ================================================================
  writer.drawSectionHeader(`58. MOLD PREVENTION AND VENTILATION`);
  writer.drawParagraph(
    `Tenant acknowledges that prevention of mold growth is a shared responsibility and agrees to maintain the Premises in a manner that prevents moisture accumulation.`
  );
  writer.drawParagraph(`Tenant specifically agrees to:`);
  writer.drawTextLine(`1. Use the bathroom ventilation fan during and after bathing or showering;`, 9.5, 16);
  writer.drawTextLine(`2. Open windows, where appropriate, to allow for proper ventilation;`, 9.5, 16);
  writer.drawTextLine(`3. Promptly notify Landlord of any water intrusion, leaks, or moisture issues.`, 9.5, 16);
  writer.drawParagraph(
    `Tenant acknowledges that failure to properly ventilate the Premises may contribute to mold growth and may be considered a breach of this Lease.`
  );
  writer.drawParagraph(
    `Notwithstanding the foregoing, Tenant shall not be responsible for mold or moisture conditions caused by plumbing leaks, structural defects, or other conditions not caused by Tenant's actions or negligence.`
  );
  writer.drawInitialsField("initials-mold", "Mold prevention acknowledged");

  // ================================================================
  // AUTOMATIC RENEWAL NOTICE
  // ================================================================
  writer.drawSpace(8);
  writer.drawBoldParagraph(
    `NOTICE: This Agreement contains an automatic renewal clause.`
  );

  // ================================================================
  // SIGNATURES
  // ================================================================
  writer.drawSpace(8);
  writer.drawLine();
  writer.drawSpace(6);
  writer.drawParagraph(
    `IN WITNESS WHEREOF, the Landlord and Tenant have executed this Agreement in the manner prescribed by law as of the Effective Date.`
  );
  writer.drawSpace(10);

  // Landlord signature (pre-filled)
  writer.drawLandlordSignature(landlordSigImage);
  writer.drawSpace(10);

  // Tenant signature field(s)
  writer.drawSignatureField(
    "tenant-signature",
    input.TENANT_1_NAME,
    "TENANT:"
  );

  if (!isSingleTenant) {
    writer.drawSpace(6);
    writer.drawSignatureField(
      "tenant2-signature",
      input.TENANT_2_NAME,
      "TENANT:"
    );
  }

  // Receipt section
  writer.drawSpace(10);
  writer.drawLine();
  writer.drawBoldLine(`RECEIPT`);
  writer.drawParagraph(
    `By Signing above Landlord hereby acknowledges prior receipt and Tenant acknowledges the prior payment of the following:`
  );
  writer.drawTextLine(`Security Deposit Amount: ${input.SECURITY_DEPOSIT}`);

  // ================================================================
  // ADDENDUM: LEAD-BASED PAINT DISCLOSURE
  // ================================================================
  writer.drawSpace(12);
  writer.drawLine();
  writer.drawSpace(6);
  writer.drawSubtitle("California Lease Agreement");
  writer.drawTitle("Disclosure of Information on Lead-Based Paint");
  writer.drawSubtitle("or Lead-Based Paint Hazards");
  writer.drawSpace(6);

  writer.drawBoldLine(`Lead Warning Statement`);
  writer.drawParagraph(
    `Housing built before 1978 may contain lead-based paint. Lead from paint, paint chips and dust can pose health hazards if not managed properly. Lead exposure is especially harmful to young children and pregnant women.`
  );
  writer.drawSpace(4);
  writer.drawBoldLine(`Landlord's Disclosure`);
  writer.drawParagraph(
    `(a) Presence of lead-based paint and/or lead-based paint hazards: Landlord has no knowledge of lead-based paint and/or lead-based paint hazards in the housing.`
  );
  writer.drawParagraph(
    `(b) Records and reports available to the landlord: Landlord has no reports or records pertaining to lead-based paint and/or lead-based paint hazards in the housing.`
  );
  writer.drawSpace(4);
  writer.drawBoldLine(`Tenant's Acknowledgment`);
  writer.drawParagraph(
    `Tenant has received copies of all information listed above and has received the pamphlet Protect Your Family From Lead In Your Home.`
  );

  // Lead paint signatures
  writer.drawSpace(4);
  writer.drawTextLine(`Acknowledged by Landlord: Makada Properties`);
  writer.drawSpace(4);

  // ================================================================
  // ADDENDUM: MOLD NOTIFICATION
  // ================================================================
  writer.drawSpace(8);
  writer.drawLine();
  writer.drawSpace(6);
  writer.drawSubtitle("California Lease Agreement");
  writer.drawTitle("Mold Notification Addendum");
  writer.drawSpace(6);

  writer.drawParagraph(
    `Landlord endeavors to maintain the highest quality living environment for the Tenant. Therefore, know that the Landlord has inspected the unit prior to lease and knows of no damp or wet building materials in the unit and knows of no mold contamination in the unit.`
  );
  writer.drawParagraph(
    `Tenant agrees to maintain the property in a manner that prevents the occurrence of an infestation of mold or mildew. Tenant agrees to uphold this responsibility in part by complying with the following:`
  );
  writer.drawTextLine(`1. Tenant agrees to keep the unit free of dirt and debris that can harbor mold.`, 9.5, 16);
  writer.drawTextLine(`2. Tenant agrees to immediately report to the Landlord any water intrusion, such as plumbing leaks, drips, or "sweating" pipes.`, 9.5, 16);
  writer.drawTextLine(`3. Tenant agrees to notify owner of overflows from bathroom, kitchen, or unit laundry facilities.`, 9.5, 16);
  writer.drawTextLine(`4. Tenant agrees to report to the Landlord any significant mold growth on surfaces inside the premises.`, 9.5, 16);
  writer.drawTextLine(`5. Tenant agrees to allow the Landlord to enter the unit to inspect and make necessary repairs.`, 9.5, 16);
  writer.drawTextLine(`6. Tenant agrees to properly ventilate the bathroom while showering or bathing.`, 9.5, 16);
  writer.drawTextLine(`7. Tenant agrees to use exhaust fans whenever cooking, dishwashing, or cleaning.`, 9.5, 16);
  writer.drawTextLine(`8. Tenant agrees to use all reasonable care to prevent outdoor water from penetrating into the interior of the unit.`, 9.5, 16);
  writer.drawTextLine(`9. Tenant agrees to clean and dry any visible moisture on windows, walls, and other surfaces as soon as reasonably possible.`, 9.5, 16);
  writer.drawTextLine(`10. Tenant agrees to notify the Landlord of any problems with any air conditioning or heating systems.`, 9.5, 16);
  writer.drawTextLine(`11. Tenant agrees to indemnify and hold harmless the Landlord from any actions, claims, losses, damages, and expenses arising from Tenant's failure to comply.`, 9.5, 16);
  writer.drawParagraph(
    `If Tenant fails to comply with the terms of this Mold Addendum, it is a material breach of the Lease Agreement it is attached to.`
  );

  // ================================================================
  // ADDENDUM: RENT CAP AND JUST CAUSE
  // ================================================================
  writer.drawSpace(8);
  writer.drawLine();
  writer.drawSpace(6);
  writer.drawTitle("Rent Cap and Just Cause Addendum");
  writer.drawSpace(6);

  writer.drawParagraph(
    `The following terms and conditions are hereby incorporated and made part of the Residential Lease or Month-to-Month Rental Agreement dated ${today} on the property at ${input.PROPERTY_ADDRESS} Unit ${input.UNIT_NUMBER}.`
  );
  writer.drawTextLine(`Tenant Name 1: ${input.TENANT_1_NAME}`);
  if (!isSingleTenant) {
    writer.drawTextLine(`Tenant Name 2: ${input.TENANT_2_NAME}`);
  }
  writer.drawParagraph(`referred to as "Tenant".`);

  writer.drawBoldLine(`I. RENT CAP AND JUST CAUSE ADDENDUM TERMS`);
  writer.drawParagraph(
    `With certain exemptions, landlord may be subject to the rent cap and just cause eviction provisions of the Civil Code. Landlord informs tenant of the following:`
  );
  writer.drawParagraph(
    `California law limits the amount your rent can be increased. See Section 1947.12 of the Civil Code for more information. California law also provides that after all of the tenants have continuously and lawfully occupied the property for 12 months or more, a landlord must provide a statement of cause in any notice to terminate a tenancy.`
  );

  writer.drawBoldLine(`II. RENT CAP REQUIREMENTS`);
  writer.drawParagraph(
    `1. Subject to certain provisions of Civil Code Section 1947.12 subdivision (b), an owner of real property shall not increase the rental rate for that property more than 5 percent plus the percentage change in the cost of living, or 10 percent, whichever is lower.`
  );
  writer.drawParagraph(
    `2. If the same tenant remains in occupancy over any 12-month period, the gross rental rate shall not be increased in more than two increments over that 12-month period.`
  );

  writer.drawBoldLine(`III. JUST CAUSE REQUIREMENTS`);
  writer.drawParagraph(
    `WITH CERTAIN EXEMPTIONS, LANDLORD MAY BE SUBJECT TO THE JUST CAUSE PROVISIONS OF CIVIL CODE SECTION 1946.2. At-fault just cause includes: default in payment of rent, breach of a material lease term, maintaining a nuisance, committing waste, criminal activity, subletting in violation of the lease, refusal to allow landlord entry, and using premises for unlawful purpose.`
  );
  writer.drawParagraph(
    `No-fault just cause includes: intent to occupy by owner or family, withdrawal from rental market, unsafe habitation per government order, and intent to demolish or substantially remodel.`
  );
  writer.drawParagraph(
    `If Owner issues a termination under No-Fault Just Cause, Owner shall provide relocation assistance equal to one month of the tenant's rent.`
  );

  writer.drawBoldLine(`Notice of Exemption:`);
  writer.drawParagraph(
    `This property is not subject to the rent limits imposed by Section 1947.12 of the Civil Code and is not subject to the just cause requirements of Section 1946.2 of the Civil Code, if applicable exemptions under law apply.`
  );

  // ================================================================
  // ADDENDUM: BED BUGS
  // ================================================================
  writer.drawSpace(8);
  writer.drawLine();
  writer.drawSpace(6);
  writer.drawTitle("Information about Bed Bugs");
  writer.drawSpace(6);

  writer.drawParagraph(
    `Bed bug Appearance: Bed bugs have six legs. Adult bed bugs have flat bodies about 1/4 of an inch in length. Their color can vary from red and brown to copper colored. Young bed bugs are very small. Their bodies are about 1/16 of an inch in length.`
  );
  writer.drawParagraph(
    `Life Cycle and Reproduction: An average bed bug lives for about 10 months. Female bed bugs lay one to five eggs per day. Bed bugs grow to full adulthood in about 21 days. Bed bugs can survive for months without feeding.`
  );
  writer.drawParagraph(
    `Bed bug Bites: Because bed bugs usually feed at night, most people are bitten in their sleep and do not realize they were bitten.`
  );
  writer.drawBoldLine(`Common signs and symptoms of a possible bed bug infestation:`);
  writer.drawTextLine(`- Small red to reddish brown fecal spots on mattresses, box springs, bed frames, linens, upholstery, or walls.`, 9.5, 16);
  writer.drawTextLine(`- Molted bed bug skins, white, sticky eggs, or empty eggshells.`, 9.5, 16);
  writer.drawTextLine(`- Very heavily infested areas may have a characteristically sweet odor.`, 9.5, 16);
  writer.drawTextLine(`- Red, itchy bite marks, especially on the legs, arms, and other body parts exposed while sleeping.`, 9.5, 16);
  writer.drawParagraph(
    `For more information, see the Internet Web sites of the United States Environmental Protection Agency and the National Pest Management Association.`
  );
  writer.drawParagraph(
    `To report suspected infestations please contact the landlord or property manager via the contact details provided in the lease agreement.`
  );

  // ================================================================
  // FOOTER
  // ================================================================
  writer.drawSpace(12);
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
 */
export async function embedSignaturesIntoPdf(
  pdfBuffer: Buffer,
  signatureImage: Buffer,
  initialsImage: Buffer | null,
  fields: SigningField[]
): Promise<Buffer> {
  const pdf = await PDFDocument.load(pdfBuffer);
  const pages = pdf.getPages();

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
      const dims = sigImg.scale(1);
      const scale = Math.min(
        (field.width - 20) / dims.width,
        (field.height - 16) / dims.height
      );
      const w = dims.width * scale;
      const h = dims.height * scale;

      page.drawRectangle({
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        color: rgb(1, 1, 1),
        borderColor: FIELD_BORDER,
        borderWidth: 1,
      });

      page.drawImage(sigImg, {
        x: field.x + (field.width - w) / 2,
        y: field.y + (field.height - h) / 2,
        width: w,
        height: h,
      });

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
