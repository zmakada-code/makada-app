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
 * Format address with unit inserted in the middle.
 * Input:  "500 N San Mateo Drive, San Mateo, CA 94401" + unit "A"
 * Output: "500 N San Mateo Drive, Apartment A, San Mateo, CA 94401"
 */
function formatAddressWithUnit(address: string, unit: string): string {
  if (!unit) return address;

  // Try to split on the first comma to insert the unit after the street
  const parts = address.split(",");
  if (parts.length >= 2) {
    // "500 N San Mateo Drive" + ", Apartment A" + ", San Mateo, CA 94401"
    return `${parts[0].trim()}, Apartment ${unit},${parts.slice(1).join(",")}`;
  }

  // Fallback: just append
  return `${address}, Apartment ${unit}`;
}

/**
 * Generate a completed lease docx from the master template.
 * Returns a Buffer containing the finished .docx file.
 */
export async function generateLease(input: LeaseInput): Promise<Buffer> {
  // Read the template
  const templateBuffer = fs.readFileSync(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);

  // Build the full address with unit in the middle
  const fullAddress = formatAddressWithUnit(input.PROPERTY_ADDRESS, input.UNIT_NUMBER);

  // Create a modified input where PROPERTY_ADDRESS includes the unit
  const replacements: Record<string, string> = { ...input };

  // Override address-related placeholders so the address reads naturally
  // The template has: "{{PROPERTY_ADDRESS}} Unit {{UNIT_NUMBER}}"
  // We want: "500 N San Mateo Drive, Apartment A, San Mateo, CA 94401"
  // So set PROPERTY_ADDRESS to the full formatted address and UNIT_NUMBER to empty
  // to avoid "Apartment A Unit A" duplication
  replacements.PROPERTY_ADDRESS = fullAddress;
  replacements.UNIT_NUMBER = ""; // already included in the formatted address

  // Process all XML files inside the docx (mainly word/document.xml)
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

    // Clean up "Unit " prefix that appears before the now-empty UNIT_NUMBER
    // The template has patterns like "{{PROPERTY_ADDRESS}} Unit {{UNIT_NUMBER}}"
    // After replacement this becomes "500 N San Mateo Drive, Apartment A, San Mateo, CA 94401 Unit "
    content = content.replace(/ Unit\s*\./g, ".");
    content = content.replace(/ Unit\s*,/g, ",");
    content = content.replace(/ Unit\s*</g, "<");

    // If single tenant, remove Tenant 2 lines from the document
    if (isSingleTenant && filename.includes("document.xml")) {
      content = removeTenant2Paragraphs(content);
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
 * Remove paragraphs that contain "Tenant 2:" or "Tenant name 2:" when empty.
 * This keeps the document clean for single-tenant leases.
 * Only removes the label lines — signature blocks are preserved.
 */
function removeTenant2Paragraphs(xml: string): string {
  // Remove entire <w:p> elements that contain "Tenant 2:" with an empty value
  // These are lines like "Tenant 2: " (with nothing after)
  // We match the pattern conservatively to avoid removing legal language

  // Pattern: a paragraph that contains "Tenant 2:" or "Tenant name 2:" followed by
  // empty text or just whitespace, and nothing else meaningful
  const patterns = [
    // "Tenant 2: " (empty, from the intro section)
    /(<w:p[^>]*>(?:(?!<\/w:p>).)*?Tenant 2:\s*<\/w:t>(?:(?!<\/w:p>).)*?<\/w:p>)/g,
    // "Tenant name 2: " (empty, from addendum sections)
    /(<w:p[^>]*>(?:(?!<\/w:p>).)*?Tenant name 2:\s*<\/w:t>(?:(?!<\/w:p>).)*?<\/w:p>)/g,
    // "Tenant Name 2: " (empty, from signature sections)
    /(<w:p[^>]*>(?:(?!<\/w:p>).)*?Tenant Name 2:\s*<\/w:t>(?:(?!<\/w:p>).)*?<\/w:p>)/g,
    // "Tenant Initials: {{TENANT_2_INITIALS}}" lines (already replaced with empty)
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
