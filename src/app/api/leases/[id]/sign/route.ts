import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * POST /api/leases/[id]/sign
 *
 * Called by the tenant portal when a tenant signs the lease.
 * Accepts the tenant's signature (base64 PNG), generates a signed
 * lease PDF with both signatures, uploads it, and updates the lease.
 *
 * Auth: x-intake-secret header (server-to-server from Replit backend)
 *
 * Body: { signature: "data:image/png;base64,..." }
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Auth check
  const secret = request.headers.get("x-intake-secret");
  if (!secret || secret !== process.env.INQUIRY_INTAKE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { signature } = await request.json();
    if (!signature) {
      return NextResponse.json({ error: "Signature is required" }, { status: 400 });
    }

    const lease = await prisma.lease.findUnique({
      where: { id: params.id },
      include: {
        tenant: true,
        unit: { include: { property: true } },
      },
    });

    if (!lease) {
      return NextResponse.json({ error: "Lease not found" }, { status: 404 });
    }

    if (lease.signingStatus !== "PENDING_SIGNATURE") {
      return NextResponse.json(
        { error: `Lease signing status is "${lease.signingStatus}", expected "PENDING_SIGNATURE"` },
        { status: 400 }
      );
    }

    // Extract the base64 image data
    const signatureBase64 = signature.replace(/^data:image\/\w+;base64,/, "");
    const signatureBuffer = Buffer.from(signatureBase64, "base64");

    // Load the landlord signature
    const fs = await import("fs");
    const path = await import("path");
    let landlordSigBuffer: Buffer | null = null;
    try {
      const sigPath = path.join(process.cwd(), "templates", "makada-signature.png");
      landlordSigBuffer = fs.readFileSync(sigPath);
    } catch {
      console.warn("Landlord signature file not found");
    }

    // Generate a proper signed lease PDF using pdf-lib
    const pdfBuffer = await generateSignedLeasePdf(
      lease,
      landlordSigBuffer,
      signatureBuffer
    );

    // Upload signed PDF to Supabase
    const supabase = createSupabaseAdminClient();
    const tenantName = lease.tenant.fullName.replace(/[^a-zA-Z0-9]/g, "_");
    const pdfFilename = `Signed_Lease_${tenantName}_Unit${lease.unit.label.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
    const storagePath = `lease/${lease.id}/${crypto.randomUUID()}-${pdfFilename}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Signed lease upload error:", uploadError);
      return NextResponse.json({ error: "Failed to upload signed lease" }, { status: 500 });
    }

    // Update lease
    await prisma.lease.update({
      where: { id: lease.id },
      data: {
        signingStatus: "SIGNED",
        signedDocStoragePath: storagePath,
        signedAt: new Date(),
      },
    });

    // Create Document record for the signed PDF
    await prisma.document.create({
      data: {
        filename: pdfFilename,
        fileUrl: "",
        storagePath,
        type: "LEASE",
        linkedEntityType: "LEASE",
        linkedEntityId: lease.id,
      },
    });

    console.log(`✅ Lease signed: ${pdfFilename} by ${lease.tenant.fullName}`);

    return NextResponse.json({
      success: true,
      signingStatus: "SIGNED",
      message: "Lease signed successfully.",
    });
  } catch (err) {
    console.error("[lease-sign] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Signing failed" },
      { status: 500 }
    );
  }
}

/**
 * Generate a professional signed lease PDF with both signatures.
 */
async function generateSignedLeasePdf(
  lease: {
    id: string;
    startDate: Date;
    endDate: Date;
    monthlyRent: unknown;
    leaseType: string;
    tenant: { fullName: string; email: string | null };
    unit: {
      label: string;
      bedrooms: number;
      bathrooms: number;
      property: { name: string; address: string };
    };
  },
  landlordSignature: Buffer | null,
  tenantSignature: Buffer
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const fontBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const fontItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);

  const dark = rgb(0.06, 0.09, 0.16);
  const muted = rgb(0.35, 0.4, 0.5);
  const accent = rgb(0.31, 0.27, 0.9);
  const lineColor = rgb(0.85, 0.87, 0.9);

  // Embed signature images
  let landlordSigImage;
  if (landlordSignature) {
    try {
      landlordSigImage = await pdf.embedPng(landlordSignature);
    } catch {
      // Try as JPEG if PNG fails
      try {
        landlordSigImage = await pdf.embedJpg(landlordSignature);
      } catch { /* skip */ }
    }
  }
  const tenantSigImage = await pdf.embedPng(tenantSignature);

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const rentAmount = `$${Number(lease.monthlyRent).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  // ---- PAGE 1: Signed Lease Agreement ----
  const page = pdf.addPage([612, 792]);
  let y = 720;

  // Header
  page.drawText("SIGNED LEASE AGREEMENT", { x: 50, y, font: fontBold, size: 22, color: dark });
  y -= 28;
  page.drawText("Makada Properties", { x: 50, y, font: fontBold, size: 14, color: accent });
  y -= 16;
  page.drawText("303 Lakeview Way, Emerald Hills, CA 94062", { x: 50, y, font, size: 9, color: muted });
  y -= 30;
  page.drawLine({ start: { x: 50, y }, end: { x: 562, y }, thickness: 1.5, color: lineColor });

  // Lease details
  y -= 35;
  page.drawText("LEASE DETAILS", { x: 50, y, font: fontBold, size: 12, color: dark });
  y -= 25;

  const details = [
    ["Tenant", lease.tenant.fullName],
    ["Property", `${lease.unit.property.name} — ${lease.unit.property.address}`],
    ["Unit", `${lease.unit.label} (${lease.unit.bedrooms} bed / ${lease.unit.bathrooms} bath)`],
    ["Monthly Rent", rentAmount],
    ["Lease Type", lease.leaseType === "MONTH_TO_MONTH" ? "Month-to-Month" : "Year-to-Year"],
    ["Lease Period", `${formatDate(lease.startDate)} — ${formatDate(lease.endDate)}`],
    ["Lease ID", lease.id],
  ];

  for (const [label, value] of details) {
    page.drawText(`${label}:`, { x: 50, y, font: fontBold, size: 10, color: muted });
    page.drawText(value, { x: 180, y, font, size: 10, color: dark });
    y -= 22;
  }

  // Note about full lease
  y -= 15;
  page.drawLine({ start: { x: 50, y }, end: { x: 562, y }, thickness: 1, color: lineColor });
  y -= 20;
  page.drawText("This document certifies that both parties have reviewed and signed the complete", {
    x: 50, y, font: fontItalic, size: 9, color: muted,
  });
  y -= 14;
  page.drawText("Residential Lease Agreement for the above property. The full lease document is", {
    x: 50, y, font: fontItalic, size: 9, color: muted,
  });
  y -= 14;
  page.drawText("on file with Makada Properties and available in the tenant portal.", {
    x: 50, y, font: fontItalic, size: 9, color: muted,
  });

  // ---- SIGNATURE SECTION ----
  y -= 40;
  page.drawText("SIGNATURES", { x: 50, y, font: fontBold, size: 12, color: dark });
  y -= 30;

  // Landlord signature
  page.drawText("Landlord:", { x: 50, y, font: fontBold, size: 10, color: muted });
  y -= 5;
  if (landlordSigImage) {
    const sigDims = landlordSigImage.scale(0.4);
    const sigW = Math.min(sigDims.width, 200);
    const sigH = (sigW / sigDims.width) * sigDims.height;
    page.drawImage(landlordSigImage, { x: 50, y: y - sigH, width: sigW, height: sigH });
    y -= sigH + 5;
  }
  page.drawLine({ start: { x: 50, y }, end: { x: 300, y }, thickness: 1, color: dark });
  y -= 15;
  page.drawText("Makada Properties", { x: 50, y, font: fontBold, size: 10, color: dark });
  y -= 12;
  page.drawText(`Date: ${new Date().toLocaleDateString("en-US")}`, { x: 50, y, font, size: 9, color: muted });

  // Tenant signature
  y -= 35;
  page.drawText("Tenant:", { x: 50, y, font: fontBold, size: 10, color: muted });
  y -= 5;
  if (tenantSigImage) {
    const sigDims = tenantSigImage.scale(0.4);
    const sigW = Math.min(sigDims.width, 200);
    const sigH = (sigW / sigDims.width) * sigDims.height;
    page.drawImage(tenantSigImage, { x: 50, y: y - sigH, width: sigW, height: sigH });
    y -= sigH + 5;
  }
  page.drawLine({ start: { x: 50, y }, end: { x: 300, y }, thickness: 1, color: dark });
  y -= 15;
  page.drawText(lease.tenant.fullName, { x: 50, y, font: fontBold, size: 10, color: dark });
  y -= 12;
  page.drawText(`Date signed: ${new Date().toLocaleDateString("en-US")}`, { x: 50, y, font, size: 9, color: muted });

  // Footer
  y = 60;
  page.drawLine({ start: { x: 50, y }, end: { x: 562, y }, thickness: 1, color: lineColor });
  y -= 15;
  page.drawText("This signed lease agreement was generated electronically by Makada Properties.", {
    x: 50, y, font, size: 8, color: muted,
  });
  y -= 12;
  page.drawText(`Generated: ${new Date().toISOString()} | Lease ID: ${lease.id}`, {
    x: 50, y, font, size: 8, color: muted,
  });

  return Buffer.from(await pdf.save());
}
