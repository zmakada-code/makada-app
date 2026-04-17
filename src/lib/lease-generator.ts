/**
 * Lease document generator.
 * Reads the master lease template (a docx file = zip of XML),
 * replaces {{PLACEHOLDER}} tags with actual values,
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

const TEMPLATE_PATH = path.join(process.cwd(), "templates", "lease-template.docx");

/**
 * Generate a completed lease docx from the master template.
 * Returns a Buffer containing the finished .docx file.
 */
export async function generateLease(input: LeaseInput): Promise<Buffer> {
  // Read the template
  const templateBuffer = fs.readFileSync(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);

  // Process all XML files inside the docx (mainly word/document.xml)
  const xmlFiles = Object.keys(zip.files).filter(
    (name) => name.endsWith(".xml") || name.endsWith(".rels")
  );

  for (const filename of xmlFiles) {
    let content = await zip.file(filename)!.async("text");

    // Replace all {{PLACEHOLDER}} patterns
    for (const [key, value] of Object.entries(input)) {
      const placeholder = `{{${key}}}`;
      // Handle XML-encoded versions too (some XML may have &amp; etc.)
      content = content.split(placeholder).join(escapeXml(value || ""));
    }

    zip.file(filename, content);
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
 * Generate a filename for the lease document.
 */
export function leaseFilename(input: LeaseInput): string {
  const tenantName = input.TENANT_1_NAME.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 40);
  const unit = input.UNIT_NUMBER.replace(/[^a-zA-Z0-9]/g, "_");
  return `Lease_${tenantName}_Unit${unit}.docx`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
