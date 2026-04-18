import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/leases/[id]/cancel
 *
 * Resets a lease's signing status back to draft so it can be re-sent.
 * Cleans up uploaded PDFs and signing metadata from storage.
 * The lease stays ACTIVE — it's just the signing that resets.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const lease = await prisma.lease.findUnique({
      where: { id: params.id },
      include: {
        tenant: { select: { fullName: true } },
        unit: {
          select: {
            id: true,
            label: true,
            property: { select: { name: true } },
          },
        },
      },
    });

    if (!lease) {
      return NextResponse.json({ error: "Lease not found" }, { status: 404 });
    }

    // Clean up storage files if they exist
    const supabase = createSupabaseAdminClient();
    const pathsToRemove: string[] = [];

    if ((lease as any).leaseDocStoragePath) {
      pathsToRemove.push((lease as any).leaseDocStoragePath);
    }
    if ((lease as any).signedDocStoragePath) {
      pathsToRemove.push((lease as any).signedDocStoragePath);
    }
    pathsToRemove.push(`lease/${lease.id}/signing-fields.json`);

    if (pathsToRemove.length > 0) {
      await supabase.storage.from("documents").remove(pathsToRemove);
    }

    // Invalidate any outstanding signing tokens for this lease
    await prisma.$executeRawUnsafe(
      `UPDATE "SigningToken" SET "usedAt" = NOW() WHERE "leaseId" = $1 AND "usedAt" IS NULL`,
      lease.id
    );

    // Reset signing status — keep the lease ACTIVE so it can be re-sent
    await prisma.lease.update({
      where: { id: params.id },
      data: {
        signingStatus: null,
        leaseDocStoragePath: null,
        signedDocStoragePath: null,
        sentForSigningAt: null,
        signedAt: null,
      } as any,
    });

    console.log(
      `🔄 Lease signing reset: ${lease.tenant.fullName} — ${lease.unit.property.name} Unit ${lease.unit.label}`
    );

    return NextResponse.json({
      success: true,
      message: `Signing cancelled for ${lease.tenant.fullName}. You can now re-send the lease.`,
    });
  } catch (err) {
    console.error("[lease-cancel] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to cancel" },
      { status: 500 }
    );
  }
}
