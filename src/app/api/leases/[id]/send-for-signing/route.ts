import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateLeasePdf, leasePdfFilename, type LeaseInput } from "@/lib/lease-pdf-generator";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * POST /api/leases/[id]/send-for-signing
 *
 * Generates a lease PDF with the landlord's signature already embedded,
 * uploads it to Supabase Storage along with signing field metadata,
 * updates the lease's signing status, and sends an email notification.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
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

    const formatDate = (d: Date) =>
      d.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

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

    // Generate the lease PDF with landlord signature embedded
    const { pdfBuffer, signingFields, pageCount } = await generateLeasePdf(input, true);
    const filename = leasePdfFilename(input);

    // Upload PDF to Supabase Storage
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
      return NextResponse.json({ error: "Failed to upload lease document" }, { status: 500 });
    }

    // Also upload the signing field metadata as JSON
    const metadataPath = `lease/${lease.id}/signing-fields.json`;
    const metadataJson = JSON.stringify({ signingFields, pageCount });

    // Delete existing metadata if any (upsert)
    await supabase.storage.from("documents").remove([metadataPath]);
    await supabase.storage
      .from("documents")
      .upload(metadataPath, Buffer.from(metadataJson), {
        contentType: "application/json",
        upsert: true,
      });

    // Update lease signing status
    await prisma.lease.update({
      where: { id: lease.id },
      data: {
        signingStatus: "PENDING_SIGNATURE",
        leaseDocStoragePath: storagePath,
        sentForSigningAt: new Date(),
      },
    });

    // Create a Document record for the unsigned lease
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

    // Send email notification
    if (lease.tenant.email) {
      try {
        await sendLeaseSigningEmail(
          lease.tenant.email,
          lease.tenant.fullName,
          lease.unit.property.name,
          lease.unit.label
        );
      } catch (emailErr) {
        console.error("Failed to send signing email:", emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      signingStatus: "PENDING_SIGNATURE",
      message: `Lease sent to ${lease.tenant.fullName} for signing.`,
    });
  } catch (err) {
    console.error("[send-for-signing] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

async function sendLeaseSigningEmail(
  email: string,
  tenantName: string,
  propertyName: string,
  unitLabel: string
) {
  const portalUrl = process.env.TENANT_PORTAL_URL || "https://zmak-zmakada.replit.app";
  const signingUrl = `${portalUrl}/tenant/leases`;

  const subject = `Lease Ready for Signing — ${propertyName}, Unit ${unitLabel}`;

  console.log(`📧 LEASE SIGNING EMAIL`);
  console.log(`  To: ${email}`);
  console.log(`  Subject: ${subject}`);
  console.log(`  Portal link: ${signingUrl}`);
  console.log(`  (Email service not configured — notification logged only)`);
}
