import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/leases/[id]/update-fields
 *
 * Updates editable lease fields (start date, end date, rent, deposit)
 * before sending for signing. Only works if lease hasn't been signed yet.
 *
 * Body: { startDate?, endDate?, monthlyRent?, securityDeposit? }
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const lease = await prisma.lease.findUnique({
      where: { id: params.id },
      include: { unit: true },
    });

    if (!lease) {
      return NextResponse.json({ error: "Lease not found" }, { status: 404 });
    }

    // Don't allow editing if already signed
    if ((lease as any).signingStatus === "SIGNED") {
      return NextResponse.json(
        { error: "Cannot edit a signed lease" },
        { status: 400 }
      );
    }

    // Build update data
    const data: any = {};

    if (body.startDate) {
      data.startDate = new Date(body.startDate);
    }
    if (body.endDate) {
      data.endDate = new Date(body.endDate);
    }
    if (body.monthlyRent) {
      data.monthlyRent = parseFloat(body.monthlyRent);
    }

    // Update lease
    if (Object.keys(data).length > 0) {
      await prisma.lease.update({
        where: { id: params.id },
        data,
      });
    }

    // Update deposit on the unit if provided
    if (body.securityDeposit) {
      await prisma.unit.update({
        where: { id: lease.unitId },
        data: { depositAmount: parseFloat(body.securityDeposit) },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[update-fields] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update" },
      { status: 500 }
    );
  }
}
