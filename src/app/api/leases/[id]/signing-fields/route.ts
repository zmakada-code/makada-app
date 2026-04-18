import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/leases/[id]/signing-fields
 *
 * Returns the signing field metadata (positions of signature/initial fields)
 * for the lease PDF. Used by the tenant portal to render the DocuSign-style
 * signing overlay.
 *
 * Auth: x-intake-secret header
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const secret = request.headers.get("x-intake-secret");
  if (!secret || secret !== process.env.INQUIRY_INTAKE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const lease = await prisma.lease.findUnique({
      where: { id: params.id },
      select: { id: true, signingStatus: true },
    });

    if (!lease) {
      return NextResponse.json({ error: "Lease not found" }, { status: 404 });
    }

    // Fetch metadata from Supabase Storage
    const supabase = createSupabaseAdminClient();
    const metadataPath = `lease/${lease.id}/signing-fields.json`;

    const { data, error } = await supabase.storage
      .from("documents")
      .download(metadataPath);

    if (error || !data) {
      return NextResponse.json(
        { error: "Signing field metadata not found" },
        { status: 404 }
      );
    }

    const metaJson = JSON.parse(await data.text());

    return NextResponse.json(metaJson);
  } catch (err) {
    console.error("[signing-fields] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
