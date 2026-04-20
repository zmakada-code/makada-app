/**
 * Lease document generator.
 * Reads the master lease template (a docx file = zip of XML),
 * replaces {{PLACEHOLDER}} tags with actual values,
 * optionally embeds signature images (landlord and/or tenant),
 * and returns a Buffer of the completed docx.
 *
 * This approach preserves ALL formatting, styles, and legal
 * language — only the placeholder text gets swapped.
 */

import fs from "fs";
import path from "path";
import JSZip from "jszip";

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

export type SignatureOptions = {
  /** PNG buffer for the landlord's signature */
  landlordSignature?: Buffer;
  /** PNG buffer for the tenant's signature */
  tenantSignature?: Buffer;
};

const TEMPLATE_PATH = path.join(process.cwd(), "templates", "lease-template.docx");
const LANDLORD_SIG_PATH = path.join(process.cwd(), "templates", "makada-signature.png");

/**
 * Format address with unit inserted in the middle.
 */
function formatAddressWithUnit(address: string, unit: string): string {
  if (!unit) return address;
  const parts = address.split(",");
  if (parts.length >= 2) {
    return `${parts[0].trim()}, Apartment ${unit},${parts.slice(1).join(",")}`;
  }
  return `${address}, Apartment ${unit}`;
}

/**
 * Build OOXML XML for an inline image in a Word document.
 * cx/cy are in EMUs (English Metric Units). 1 inch = 914400 EMUs.
 */
function buildInlineImageXml(rId: string, cx: number, cy: number, name: string): string {
  return (
    `<w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="1" name="${name}"/>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr>` +
    `<pic:cNvPr id="0" name="${name}"/>` +
    `<pic:cNvPicPr/>` +
    `</pic:nvPicPr>` +
    `<pic:blipFill>` +
    `<a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>` +
    `<a:stretch><a:fillRect/></a:stretch>` +
    `</pic:blipFill>` +
    `<pic:spPr>` +
    `<a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
    `</pic:spPr>` +
    `</pic:pic>` +
    `</a:graphicData>` +
    `</a:graphic>` +
    `</wp:inline>` +
    `</w:drawing>`
  );
}

/**
 * Add an image to the docx zip and register it as a relationship.
 * Returns the relationship ID.
 */
async function addImageToDocx(
  zip: JSZip,
  imageBuffer: Buffer,
  imageName: string
): Promise<string> {
  // Add image to word/media/
  zip.file(`word/media/${imageName}`, imageBuffer);

  // Add PNG content type if not present
  let contentTypes = await zip.file("[Content_Types].xml")!.async("text");
  if (!contentTypes.includes('Extension="png"')) {
    contentTypes = contentTypes.replace(
      "</Types>",
      `<Default Extension="png" ContentType="image/png"/></Types>`
    );
    zip.file("[Content_Types].xml", contentTypes);
  }

  // Add relationship in word/_rels/document.xml.rels
  let rels = await zip.file("word/_rels/document.xml.rels")!.async("text");
  // Find the next available rId
  const existingIds = [...rels.matchAll(/Id="rId(\d+)"/g)].map((m) => parseInt(m[1]));
  const nextId = Math.max(...existingIds, 0) + 1;
  const rId = `rId${nextId}`;

  rels = rels.replace(
    "</Relationships>",
    `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${imageName}"/></Relationships>`
  );
  zip.file("word/_rels/document.xml.rels", rels);

  return rId;
}

/**
 * Embed a signature image at the landlord "By:" lines in the document.
 * Replaces "By: ___________________________________ MZAN Capital" with the signature image + "MZAN Capital"
 */
function embedLandlordSignature(xml: string, rId: string): string {
  // Signature image: ~2 inches wide, ~0.5 inches tall
  const cx = 1828800; // 2 inches in EMUs
  const cy = 457200;  // 0.5 inches in EMUs
  const imageXml = buildInlineImageXml(rId, cx, cy, "LandlordSignature");

  // Replace the underscore signature lines for landlord
  // Pattern: "By: ___________________________________ MZAN Capital"
  // We want to keep "By: " + add signature image + " MZAN Capital"
  // The text is in <w:t> elements. We replace the underscore text with the image.
  xml = xml.replace(
    /(<w:t[^>]*>)(By: _{10,} MZAN Capital\s*?)(<\/w:t>)/g,
    (_match, openTag, _text, closeTag) => {
      // Replace with: "By: " then close text, add drawing, then "MZAN Capital"
      return (
        `${openTag}By: ${closeTag}</w:r>` +
        `<w:r><w:rPr></w:rPr>${imageXml}</w:r>` +
        `<w:r><w:rPr></w:rPr><w:t xml:space="preserve"> MZAN Capital</w:t></w:r>` +
        `<w:r><w:rPr></w:rPr><w:t xml:space="preserve">`  // dummy to close the original structure
      );
    }
  );

  return xml;
}

/**
 * Embed a tenant signature image at the tenant "By:" lines in the document.
 * These are the lines like "By: ___________________________________" followed by "Tenant Name 1:"
 */
function embedTenantSignature(xml: string, rId: string): string {
  const cx = 1828800; // 2 inches
  const cy = 457200;  // 0.5 inches
  const imageXml = buildInlineImageXml(rId, cx, cy, "TenantSignature");

  // Find tenant "By:" lines (those NOT followed by "MZAN Capital")
  // These are standalone "By: ___________________________________" lines
  xml = xml.replace(
    /(<w:t[^>]*>)(By: _{10,})(<\/w:t>)/g,
    (_match, openTag, _text, closeTag) => {
      return (
        `${openTag}By: ${closeTag}</w:r>` +
        `<w:r><w:rPr></w:rPr>${imageXml}</w:r>` +
        `<w:r><w:rPr></w:rPr><w:t xml:space="preserve">`
      );
    }
  );

  return xml;
}

/**
 * Generate a completed lease docx from the master template.
 * Returns a Buffer containing the finished .docx file.
 *
 * @param input - The lease field values
 * @param signatures - Optional signature images to embed
 */
export async function generateLease(
  input: LeaseInput,
  signatures?: SignatureOptions
): Promise<Buffer> {
  // Read the template
  const templateBuffer = fs.readFileSync(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);

  // Build the full address with unit in the middle
  const fullAddress = formatAddressWithUnit(input.PROPERTY_ADDRESS, input.UNIT_NUMBER);

  // Create a modified input where PROPERTY_ADDRESS includes the unit
  const replacements: Record<string, string> = { ...input };
  replacements.PROPERTY_ADDRESS = fullAddress;
  replacements.UNIT_NUMBER = "";

  // Load landlord signature if not provided but file exists
  let landlordSig = signatures?.landlordSignature;
  if (!landlordSig) {
    try {
      landlordSig = fs.readFileSync(LANDLORD_SIG_PATH);
    } catch {
      // No landlord signature file — skip embedding
    }
  }

  // Add signature images to the docx zip
  let landlordSigRId: string | undefined;
  let tenantSigRId: string | undefined;

  if (landlordSig) {
    landlordSigRId = await addImageToDocx(zip, landlordSig, "landlord-signature.png");
  }
  if (signatures?.tenantSignature) {
    tenantSigRId = await addImageToDocx(zip, signatures.tenantSignature, "tenant-signature.png");
  }

  // Process all XML files inside the docx
  const xmlFiles = Object.keys(zip.files).filter(
    (name) => name.endsWith(".xml") || name.endsWith(".rels")
  );

  const isSingleTenant = !input.TENANT_2_NAME?.trim();

  for (const filename of xmlFiles) {
    let content = await zip.file(filename)!.async("text");

    // Replace all {{PLACEHOLDER}} patterns
    for (const [key, value] of Object.entries(replacements)) {
      const placeholder = `{{${key}}}`;
      content = content.split(placeholder).join(escapeXml(value || ""));
    }

    // Clean up "Unit " prefix
    content = content.replace(/ Unit\s*\./g, ".");
    content = content.replace(/ Unit\s*,/g, ",");
    content = content.replace(/ Unit\s*</g, "<");

    // If single tenant, remove Tenant 2 lines
    if (isSingleTenant && filename.includes("document.xml")) {
      content = removeTenant2Paragraphs(content);
    }

    // Embed signatures in document.xml
    if (filename.includes("document.xml")) {
      // Landlord signature must be embedded BEFORE tenant signature
      // because the landlord regex is more specific (includes "MZAN Capital")
      if (landlordSigRId) {
        content = embedLandlordSignature(content, landlordSigRId);
      }
      if (tenantSigRId) {
        content = embedTenantSignature(content, tenantSigRId);
      }
    }

    zip.file(filename, content);
  }

  // Ensure drawing namespaces are declared in document.xml
  if (landlordSigRId || tenantSigRId) {
    let docXml = await zip.file("word/document.xml")!.async("text");
    // Add required namespaces if missing
    if (!docXml.includes('xmlns:wp=')) {
      docXml = docXml.replace(
        '<w:document ',
        '<w:document xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
      );
    }
    if (!docXml.includes('xmlns:r=')) {
      docXml = docXml.replace(
        '<w:document ',
        '<w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
      );
    }
    zip.file("word/document.xml", docXml);
  }

  // Generate the output buffer
  const output = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return output;
}

/**
 * Remove paragraphs that contain "Tenant 2:" or "Tenant name 2:" when empty.
 */
function removeTenant2Paragraphs(xml: string): string {
  const patterns = [
    /(<w:p[^>]*>(?:(?!<\/w:p>).)*?Tenant 2:\s*<\/w:t>(?:(?!<\/w:p>).)*?<\/w:p>)/g,
    /(<w:p[^>]*>(?:(?!<\/w:p>).)*?Tenant name 2:\s*<\/w:t>(?:(?!<\/w:p>).)*?<\/w:p>)/g,
    /(<w:p[^>]*>(?:(?!<\/w:p>).)*?Tenant Name 2:\s*<\/w:t>(?:(?!<\/w:p>).)*?<\/w:p>)/g,
    /(<w:p[^>]*>(?:(?!<\/w:p>).)*?Tenant Initials:\s*Tenant name 2:\s*<\/w:t>(?:(?!<\/w:p>).)*?<\/w:p>)/g,
  ];

  for (const pattern of patterns) {
    xml = xml.replace(pattern, "");
  }

  return xml;
}

/**
 * Generate a filename for the lease document.
 */
export function leaseFilename(input: LeaseInput): string {
  const tenantName = input.TENANT_1_NAME.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 40);
  const unit = input.UNIT_NUMBER || "unit";
  return `Lease_${tenantName}_Unit${unit.replace(/[^a-zA-Z0-9]/g, "_")}.docx`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
