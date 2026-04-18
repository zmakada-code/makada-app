import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/leases/[id]/cancel
 *
 * Voids a lease — sets status to TERMINATED, clears signing status,
 * and optionally removes uploaded lease documents from storage.
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
    // Also remove the signing fields metadata
    pathsToRemove.push(`lease/${lease.id}/signing-fields.json`);

    if (pathsToRemove.length > 0) {
      await supabase.storage.from("documents").remove(pathsToRemove);
    }

    // Void the lease
    await prisma.lease.update({
      where: { id: params.id },
      data: {
        status: "TERMINATED",
        signingStatus: null,
        leaseDocStoragePath: null,
        signedDocStoragePath: null,
        sentForSigningAt: null,
        signedAt: null,
      } as any,
    });

    // Set the unit back to VACANT
    await prisma.unit.update({
      where: { id: lease.unitId },
      data: { occupancyStatus: "VACANT" },
    });

    console.log(
      `❌ Lease voided: ${lease.tenant.fullName} — ${lease.unit.property.name} Unit ${lease.unit.label}`
    );

    return NextResponse.json({
      success: true,
      message: `Lease for ${lease.tenant.fullName} has been voided.`,
    });
  } catch (err) {
    console.error("[lease-cancel] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to cancel lease" },
      { status: 500 }
    );
  }
}
