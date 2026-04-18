import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/leases/[id]/download?type=unsigned|signed
 *
 * Downloads the lease PDF (unsigned or signed) directly from Supabase
 * and streams it back as a proper PDF download.
 *
 * Supports both admin app access (no auth header) and
 * tenant portal access (x-intake-secret header).
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "unsigned";

    // Allow access from tenant portal via secret, or from admin app directly
    const secret = request.headers.get("x-intake-secret");
    const isServerCall = secret && secret === process.env.INQUIRY_INTAKE_SECRET;

    // For now, allow both admin and tenant access
    // In production, add proper session-based auth for admin

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

    const storagePath =
      type === "signed"
        ? lease.signedDocStoragePath
        : lease.leaseDocStoragePath;

    if (!storagePath) {
      return NextResponse.json(
        { error: `No ${type} lease document available` },
        { status: 404 }
      );
    }

    // Download from Supabase Storage
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.storage
      .from("documents")
      .download(storagePath);

    if (error || !data) {
      console.error(`[lease-download] storage error:`, error);
      return NextResponse.json(
        { error: "Failed to retrieve document" },
        { status: 500 }
      );
    }

    const buffer = await data.arrayBuffer();
    const tenantName = lease.tenant.fullName.replace(/[^a-zA-Z0-9]/g, "_");
    const unit = lease.unit.label.replace(/[^a-zA-Z0-9]/g, "_");
    const prefix = type === "signed" ? "Signed_" : "";
    const filename = `${prefix}Lease_${tenantName}_Unit${unit}.pdf`;

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("[lease-download] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
