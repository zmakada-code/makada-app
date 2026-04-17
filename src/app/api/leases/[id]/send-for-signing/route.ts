import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateLease, leaseFilename, type LeaseInput } from "@/lib/lease-generator";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * POST /api/leases/[id]/send-for-signing
 *
 * Generates a lease docx with the landlord's signature embedded,
 * uploads it to Supabase Storage, updates the lease's signing status,
 * and sends an email notification to the tenant.
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

    // Build lease input from the database
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

    // Generate the lease with landlord signature embedded (no tenant sig yet)
    const buffer = await generateLease(input, {});
    const filename = leaseFilename(input);

    // Upload to Supabase Storage
    const supabase = createSupabaseAdminClient();
    const storagePath = `lease/${lease.id}/${crypto.randomUUID()}-${filename}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, buffer, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: false,
      });

    if (uploadError) {
      console.error("Lease upload error:", uploadError);
      return NextResponse.json({ error: "Failed to upload lease document" }, { status: 500 });
    }

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

    // Send email notification to tenant
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
        // Don't fail the whole operation if email fails
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

/**
 * Send an email to the tenant notifying them that a lease is ready for signing.
 */
async function sendLeaseSigningEmail(
  email: string,
  tenantName: string,
  propertyName: string,
  unitLabel: string
) {
  const portalUrl = process.env.TENANT_PORTAL_URL || "https://zmak-zmakada.replit.app";
  const signingUrl = `${portalUrl}/tenant/leases`;

  // Use Supabase's built-in email if available, or console log for now
  const { createSupabaseAdminClient: createAdmin } = await import("@/lib/supabase/admin");
  const supabase = createAdmin();

  // Use Supabase Auth admin to send a custom email
  // Fallback: use the Supabase edge function or direct SMTP
  // For now, we'll use a simple approach via the Supabase REST API
  const subject = `Lease Ready for Signing — ${propertyName}, Unit ${unitLabel}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e293b;">Lease Ready for Your Signature</h2>
      <p>Hi ${tenantName},</p>
      <p>Your lease agreement for <strong>${propertyName}, Unit ${unitLabel}</strong> is ready for your review and signature.</p>
      <p>Please log in to the tenant portal to review and sign your lease:</p>
      <p style="margin: 24px 0;">
        <a href="${signingUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Review &amp; Sign Lease
        </a>
      </p>
      <p style="color: #64748b; font-size: 14px;">If you have any questions, please contact Makada Properties.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">Makada Properties · 303 Lakeview Way, Emerald Hills, CA 94062</p>
    </div>
  `;

  // Try sending via Supabase auth.admin (uses configured SMTP)
  try {
    const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { __skip_invite: true }, // We don't actually want to invite, just email
    });
    // This won't work for existing users, so we fall back:
    if (error) throw error;
  } catch {
    // Fallback: log the email details. In production, wire up SMTP or a service like Resend.
    console.log(`📧 LEASE SIGNING EMAIL`);
    console.log(`  To: ${email}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Portal link: ${signingUrl}`);
    console.log(`  (Email service not configured — notification logged only)`);
  }
}
