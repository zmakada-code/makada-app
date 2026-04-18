import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSignedDocumentUrl } from "@/lib/supabase/admin";
import { embedSignaturesIntoPdf, type SigningField } from "@/lib/lease-pdf-generator";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * GET /api/sign/[token]
 *
 * Returns lease info, PDF URL, and signing fields for the token-based
 * signing page. No authentication required — the token IS the auth.
 */
export async function GET(
  _request: Request,
  { params }: { params: { token: string } }
) {
  try {
    // Look up the signing token
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT st.*, l."leaseDocStoragePath", l."signingStatus",
              t."fullName" as "tenantName", t."email" as "tenantEmail",
              u."label" as "unitLabel", u."bedrooms", u."bathrooms",
              p."name" as "propertyName", p."address" as "propertyAddress",
              l."startDate", l."endDate", l."monthlyRent", l."leaseType"
       FROM "SigningToken" st
       JOIN "Lease" l ON l."id" = st."leaseId"
       JOIN "Tenant" t ON t."id" = l."tenantId"
       JOIN "Unit" u ON u."id" = l."unitId"
       JOIN "Property" p ON p."id" = u."propertyId"
       WHERE st."token" = $1`,
      params.token
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Invalid or expired signing link" }, { status: 404 });
    }

    const row = rows[0];

    // Check if token is expired
    if (new Date(row.expiresAt) < new Date()) {
      return NextResponse.json({ error: "This signing link has expired. Please contact Makada Properties for a new one." }, { status: 410 });
    }

    // Check if already used
    if (row.usedAt) {
      return NextResponse.json({ error: "This lease has already been signed." }, { status: 410 });
    }

    // Check lease status
    if (row.signingStatus !== "PENDING_SIGNATURE") {
      return NextResponse.json({ error: "This lease is no longer available for signing." }, { status: 410 });
    }

    // Get signed URL for the PDF
    let pdfUrl: string | null = null;
    if (row.leaseDocStoragePath) {
      pdfUrl = await getSignedDocumentUrl(row.leaseDocStoragePath, 60 * 60);
    }

    // Get signing fields
    const supabase = createSupabaseAdminClient();
    let signingFields: SigningField[] = [];
    let pageCount = 0;

    const metadataPath = `lease/${row.leaseId}/signing-fields.json`;
    const { data: metaData } = await supabase.storage
      .from("documents")
      .download(metadataPath);

    if (metaData) {
      try {
        const metaJson = JSON.parse(await metaData.text());
        signingFields = metaJson.signingFields || [];
        pageCount = metaJson.pageCount || 0;
      } catch { /* skip */ }
    }

    return NextResponse.json({
      leaseId: row.leaseId,
      tenantName: row.tenantName,
      email: row.email,
      propertyName: row.propertyName,
      propertyAddress: row.propertyAddress,
      unitLabel: row.unitLabel,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      startDate: row.startDate,
      endDate: row.endDate,
      monthlyRent: Number(row.monthlyRent),
      leaseType: row.leaseType,
      pdfUrl,
      signingFields,
      pageCount,
    });
  } catch (err) {
    console.error("[sign-token GET] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sign/[token]
 *
 * Submit a signature via the token-based signing link.
 * Embeds the signature into the PDF, updates the lease,
 * and auto-creates a tenant portal account.
 *
 * Body: { signature: "data:image/png;base64,...", initials?: "data:image/png;base64,..." }
 */
export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const { signature, initials } = await request.json();
    if (!signature) {
      return NextResponse.json({ error: "Signature is required" }, { status: 400 });
    }

    // Look up and validate token
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT st.*, l."leaseDocStoragePath", l."signingStatus"
       FROM "SigningToken" st
       JOIN "Lease" l ON l."id" = st."leaseId"
       WHERE st."token" = $1`,
      params.token
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Invalid signing link" }, { status: 404 });
    }

    const row = rows[0];

    if (new Date(row.expiresAt) < new Date()) {
      return NextResponse.json({ error: "This signing link has expired" }, { status: 410 });
    }
    if (row.usedAt) {
      return NextResponse.json({ error: "This lease has already been signed" }, { status: 410 });
    }
    if (row.signingStatus !== "PENDING_SIGNATURE") {
      return NextResponse.json({ error: "Lease is not available for signing" }, { status: 410 });
    }
    if (!row.leaseDocStoragePath) {
      return NextResponse.json({ error: "Lease PDF not found" }, { status: 500 });
    }

    const supabase = createSupabaseAdminClient();

    // Download the original PDF
    const { data: pdfData, error: pdfError } = await supabase.storage
      .from("documents")
      .download(row.leaseDocStoragePath);

    if (pdfError || !pdfData) {
      return NextResponse.json({ error: "Could not retrieve lease PDF" }, { status: 500 });
    }

    const pdfBuffer = Buffer.from(await pdfData.arrayBuffer());

    // Get signing field metadata
    const metadataPath = `lease/${row.leaseId}/signing-fields.json`;
    let signingFields: SigningField[] = [];
    const { data: metaData } = await supabase.storage
      .from("documents")
      .download(metadataPath);
    if (metaData) {
      try {
        signingFields = JSON.parse(await metaData.text()).signingFields || [];
      } catch { /* skip */ }
    }

    // Embed signatures
    const signatureBase64 = signature.replace(/^data:image\/\w+;base64,/, "");
    const signatureBuffer = Buffer.from(signatureBase64, "base64");
    let initialsBuffer: Buffer | null = null;
    if (initials) {
      const initialsBase64 = initials.replace(/^data:image\/\w+;base64,/, "");
      initialsBuffer = Buffer.from(initialsBase64, "base64");
    }

    const signedPdfBuffer = await embedSignaturesIntoPdf(
      pdfBuffer,
      signatureBuffer,
      initialsBuffer,
      signingFields
    );

    // Upload signed PDF
    const tenantName = row.tenantName.replace(/[^a-zA-Z0-9]/g, "_");
    const pdfFilename = `Signed_Lease_${tenantName}.pdf`;
    const storagePath = `lease/${row.leaseId}/${crypto.randomUUID()}-${pdfFilename}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, signedPdfBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: "Failed to upload signed lease" }, { status: 500 });
    }

    // Update lease — mark as signed and set status to ACTIVE
    await prisma.lease.update({
      where: { id: row.leaseId },
      data: {
        signingStatus: "SIGNED",
        signedDocStoragePath: storagePath,
        signedAt: new Date(),
        status: "ACTIVE",
      } as any,
    });

    // Set the unit to OCCUPIED
    const leaseForUnit = await prisma.lease.findUnique({
      where: { id: row.leaseId },
      select: { unitId: true },
    });
    if (leaseForUnit) {
      await prisma.unit.update({
        where: { id: leaseForUnit.unitId },
        data: { occupancyStatus: "OCCUPIED" },
      });
    }

    // Mark token as used
    await prisma.$executeRawUnsafe(
      `UPDATE "SigningToken" SET "usedAt" = NOW() WHERE "token" = $1`,
      params.token
    );

    // Create Document record
    await prisma.document.create({
      data: {
        filename: pdfFilename,
        fileUrl: "",
        storagePath,
        type: "LEASE",
        linkedEntityType: "LEASE",
        linkedEntityId: row.leaseId,
      },
    });

    // Auto-create tenant portal account
    let accountCreated = false;
    try {
      const tempPassword = crypto.randomBytes(12).toString("base64url");
      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
          email: row.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: row.tenantName },
        });

      if (authError) {
        // User might already exist — that's fine
        if (!authError.message?.includes("already been registered")) {
          console.warn("[sign-token] Could not create auth user:", authError.message);
        }
      } else if (authData?.user) {
        accountCreated = true;
        console.log(`✅ Created portal account for ${row.email}`);

        // Send password reset email so they can set their own password
        await supabase.auth.admin.generateLink({
          type: "recovery",
          email: row.email,
        });
      }
    } catch (authErr) {
      console.error("[sign-token] Auth account creation failed:", authErr);
    }

    console.log(`✅ Lease signed via email link: ${row.tenantName} (${row.email})`);

    return NextResponse.json({
      success: true,
      signingStatus: "SIGNED",
      accountCreated,
      message: "Lease signed successfully.",
    });
  } catch (err) {
    console.error("[sign-token POST] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Signing failed" },
      { status: 500 }
    );
  }
}
