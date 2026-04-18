import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateLeasePdf, leasePdfFilename, type LeaseInput } from "@/lib/lease-pdf-generator";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendLeaseSigningInvite } from "@/lib/email";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * POST /api/leases/[id]/send-via-email
 *
 * Send a lease for signing via email to a specific email address.
 * Creates a secure one-time signing token. The recipient clicks the link,
 * views and signs the PDF, and the signed version returns to the admin app.
 *
 * Works for both existing and new tenants.
 *
 * Body: { email?: string } (optional override; defaults to tenant's email)
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));

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

    const recipientEmail = (body.email || lease.tenant.email || "").trim().toLowerCase();
    if (!recipientEmail) {
      return NextResponse.json(
        { error: "No email address provided and tenant has no email on file" },
        { status: 400 }
      );
    }

    // Generate the lease PDF with landlord signature
    const formatDate = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const nameParts = lease.tenant.fullName.split(" ");
    const initials =
      nameParts.length >= 2
        ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
        : nameParts[0]?.substring(0, 2).toUpperCase() || "";

    const input: LeaseInput = {
      TENANT_1_NAME: lease.tenant.fullName,
      TENANT_2_NAME: "",
      PROPERTY_ADDRESS: lease.unit.property.address,
      UNIT_NUMBER: lease.unit.label,
      BEDROOM_COUNT: String(lease.unit.bedrooms),
      BATHROOM_COUNT: String(lease.unit.bathrooms),
      RENT_AMOUNT: `$${Number(lease.monthlyRent).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      SECURITY_DEPOSIT: `$${Number(lease.unit.depositAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      START_DATE: formatDate(lease.startDate),
      END_DATE: formatDate(lease.endDate),
      EFFECTIVE_DATE: formatDate(lease.startDate),
      PARKING_SPACE: "As assigned by management",
      STORAGE_DESCRIPTION: "",
      TENANT_1_INITIALS: initials,
      TENANT_2_INITIALS: "",
      TENANT_1_SIGN_DATE: "",
      TENANT_2_SIGN_DATE: "",
    };

    const { pdfBuffer, signingFields, pageCount } = await generateLeasePdf(input, true);
    const filename = leasePdfFilename(input);

    // Upload PDF to storage
    const supabase = createSupabaseAdminClient();
    const storagePath = `lease/${lease.id}/${crypto.randomUUID()}-${filename}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, pdfBuffer, {
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
      .upload(metadataPath, Buffer.from(JSON.stringify({ signingFields, pageCount })), {
        contentType: "application/json",
        upsert: true,
      });

    // Generate a secure signing token (valid for 7 days)
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Store the token directly in the database
    await prisma.$executeRawUnsafe(
      `INSERT INTO "SigningToken" ("id", "token", "leaseId", "email", "tenantName", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      crypto.randomUUID(),
      token,
      lease.id,
      recipientEmail,
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

    // Create Document record
    await prisma.document.create({
      data: {
        filename: `UNSIGNED-${filename}`,
        fileUrl: "",
        storagePath,
        type: "LEASE",
        linkedEntityType: "LEASE",
        linkedEntityId: lease.id,
      },
    });

    // Send the email with the signing link
    try {
      await sendLeaseSigningInvite(
        recipientEmail,
        lease.tenant.fullName,
        lease.unit.property.name,
        lease.unit.label,
        token
      );
    } catch (emailErr) {
      console.error("[send-via-email] email delivery failed:", emailErr);
      return NextResponse.json(
        { error: `Lease was prepared but email failed to send: ${(emailErr as Error).message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      signingStatus: "PENDING_SIGNATURE",
      message: `Lease signing link sent to ${recipientEmail}.`,
    });
  } catch (err) {
    console.error("[send-via-email] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
