import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/payments
 * Log a manual payment (check, cash, etc.) from the admin app.
 * Body: { leaseId, period, method, amountPaid?, note? }
 */
export async function POST(req: NextRequest) {
  try {
    const { leaseId, period, method, amountPaid, note } = await req.json();

    if (!leaseId || !period || !method) {
      return NextResponse.json(
        { error: "leaseId, period, and method are required" },
        { status: 400 }
      );
    }

    const validMethods = ["CHECK", "CASH", "ONLINE", "OTHER"];
    if (!validMethods.includes(method)) {
      return NextResponse.json(
        { error: `Invalid method. Must be one of: ${validMethods.join(", ")}` },
        { status: 400 }
      );
    }

    const payment = await prisma.paymentStatus.upsert({
      where: { leaseId_period: { leaseId, period } },
      update: {
        status: "PAID",
        method,
        amountPaid: amountPaid ?? null,
        paidAt: new Date(),
        note: note ?? null,
      },
      create: {
        leaseId,
        period,
        status: "PAID",
        method,
        amountPaid: amountPaid ?? null,
        paidAt: new Date(),
        note: note ?? null,
      },
    });

    return NextResponse.json({ payment });
  } catch (err) {
    console.error("Manual payment logging error:", err);
    return NextResponse.json({ error: "Failed to log payment" }, { status: 500 });
  }
}
