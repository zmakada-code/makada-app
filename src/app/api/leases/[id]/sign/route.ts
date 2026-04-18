import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { embedSignaturesIntoPdf, type SigningField } from "@/lib/lease-pdf-generator";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * POST /api/leases/[id]/sign
 *
 * Called by the tenant portal when a tenant signs the lease.
 * Accepts the tenant's signature + initials (base64 PNG), reads the
 * original lease PDF and signing field metadata from storage,
 * embeds the signature/initials onto the actual PDF, and saves the result.
 *
 * Auth: x-intake-secret header (server-to-server from Replit backend)
 *
 * Body: {
 *   signature: "data:image/png;base64,...",
 *   initials: "data:image/png;base64,..." (optional)
 * }
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const secret = request.headers.get("x-intake-secret");
  if (!secret || secret !== process.env.INQUIRY_INTAKE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { signature, initials } = await request.json();
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

    if (!lease.leaseDocStoragePath) {
      return NextResponse.json(
        { error: "Lease PDF not found in storage" },
        { status: 400 }
      );
    }

    // Extract the base64 image data
    const signatureBase64 = signature.replace(/^data:image\/\w+;base64,/, "");
    const signatureBuffer = Buffer.from(signatureBase64, "base64");

    let initialsBuffer: Buffer | null = null;
    if (initials) {
      const initialsBase64 = initials.replace(/^data:image\/\w+;base64,/, "");
      initialsBuffer = Buffer.from(initialsBase64, "base64");
    }

    const supabase = createSupabaseAdminClient();

    // Download the original lease PDF
    const { data: pdfData, error: pdfError } = await supabase.storage
      .from("documents")
      .download(lease.leaseDocStoragePath);

    if (pdfError || !pdfData) {
      console.error("Failed to download lease PDF:", pdfError);
      return NextResponse.json(
        { error: "Could not retrieve lease PDF" },
        { status: 500 }
      );
    }

    const pdfBuffer = Buffer.from(await pdfData.arrayBuffer());

    // Download the signing field metadata
    const metadataPath = `lease/${lease.id}/signing-fields.json`;
    let signingFields: SigningField[] = [];

    const { data: metaData } = await supabase.storage
      .from("documents")
      .download(metadataPath);

    if (metaData) {
      try {
        const metaJson = JSON.parse(await metaData.text());
        signingFields = metaJson.signingFields || [];
      } catch {
        console.warn("Could not parse signing fields metadata");
      }
    }

    // Embed signatures into the actual lease PDF
    const signedPdfBuffer = await embedSignaturesIntoPdf(
      pdfBuffer,
      signatureBuffer,
      initialsBuffer,
      signingFields
    );

    // Upload signed PDF
    const tenantName = lease.tenant.fullName.replace(/[^a-zA-Z0-9]/g, "_");
    const pdfFilename = `Signed_Lease_${tenantName}_Unit${lease.unit.label.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
    const storagePath = `lease/${lease.id}/${crypto.randomUUID()}-${pdfFilename}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, signedPdfBuffer, {
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

    // Create Document record
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
