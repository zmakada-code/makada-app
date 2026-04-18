import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendLeaseSigningInvite } from "@/lib/email";
import { convertDocxToPdf, appendSigningPage } from "@/lib/docx-to-pdf";
import type { SigningField } from "@/lib/lease-pdf-generator";
import crypto from "crypto";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const LANDLORD_SIG_PATH = path.join(
  process.cwd(),
  "templates",
  "makada-signature.png"
);

/**
 * POST /api/leases/[id]/send-with-document
 *
 * Send a lease for signing via email using an uploaded document (.docx or .pdf).
 * The document is converted to PDF (if needed), a signing page is appended,
 * and the result is sent to the tenant for signing.
 *
 * Body: FormData with:
 *   - file: The .docx or .pdf file
 *   - email: Recipient email address
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const email = (formData.get("email") as string || "").trim().toLowerCase();

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: "Email address is required" }, { status: 400 });
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

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    let pdfBuffer: Buffer;

    const fileName = file.name.toLowerCase();
    if (fileName.endsWith(".docx") || fileName.endsWith(".doc")) {
      // Convert DOCX to PDF
      console.log(`📄 Converting ${file.name} to PDF...`);
      pdfBuffer = await convertDocxToPdf(Buffer.from(arrayBuffer));
      console.log(`✅ DOCX converted to PDF successfully`);
    } else if (fileName.endsWith(".pdf")) {
      pdfBuffer = Buffer.from(arrayBuffer);
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a .docx or .pdf file." },
        { status: 400 }
      );
    }

    // Load landlord signature if available
    let landlordSigBuffer: Buffer | undefined;
    try {
      landlordSigBuffer = fs.readFileSync(LANDLORD_SIG_PATH);
    } catch {
      console.warn("No landlord signature found at", LANDLORD_SIG_PATH);
    }

    // Append signing page with signature/initials/date fields
    const {
      pdfBuffer: finalPdf,
      signingFields,
      pageCount,
    } = await appendSigningPage(
      pdfBuffer,
      lease.tenant.fullName,
      lease.unit.property.address,
      lease.unit.label,
      landlordSigBuffer
    );

    // Upload PDF to Supabase Storage
    const supabase = createSupabaseAdminClient();
    const tenantName = lease.tenant.fullName.replace(/[^a-zA-Z0-9]/g, "_");
    const pdfFilename = `Lease_${tenantName}_Unit${lease.unit.label}.pdf`;
    const storagePath = `lease/${lease.id}/${crypto.randomUUID()}-${pdfFilename}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, finalPdf, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Lease upload error:", uploadError);
      return NextResponse.json({ error: "Failed to upload lease" }, { status: 500 });
    }

    // Store signing field metadata
    const metadataPath = `lease/${lease.id}/signing-fields.json`;
    await supabase.storage.from("documents").remove([metadataPath]);
    await supabase.storage
      .from("documents")
      .upload(
        metadataPath,
        Buffer.from(JSON.stringify({ signingFields, pageCount })),
        { contentType: "application/json", upsert: true }
      );

    // Generate secure signing token (valid 7 days)
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.$executeRawUnsafe(
      `INSERT INTO "SigningToken" ("id", "token", "leaseId", "email", "tenantName", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      crypto.randomUUID(),
      token,
      lease.id,
      email,
      lease.tenant.fullName,
      expiresAt
    );

    // Update the lease
    await prisma.lease.update({
      where: { id: lease.id },
      data: {
        signingStatus: "PENDING_SIGNATURE",
        leaseDocStoragePath: storagePath,
        sentForSigningAt: new Date(),
      } as any,
    });

    // Create Document record for the unsigned lease
    await prisma.document.create({
      data: {
        filename: `UNSIGNED-${pdfFilename}`,
        fileUrl: "",
        storagePath,
        type: "LEASE",
        linkedEntityType: "LEASE",
        linkedEntityId: lease.id,
      },
    });

    // Send the email
    try {
      await sendLeaseSigningInvite(
        email,
        lease.tenant.fullName,
        lease.unit.property.name,
        lease.unit.label,
        token
      );
    } catch (emailErr) {
      console.error("[send-with-document] email delivery failed:", emailErr);
      return NextResponse.json(
        {
          error: `Lease was uploaded and prepared, but email failed to send: ${(emailErr as Error).message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      signingStatus: "PENDING_SIGNATURE",
      message: `Lease document uploaded and signing link sent to ${email}.`,
    });
  } catch (err) {
    console.error("[send-with-document] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
