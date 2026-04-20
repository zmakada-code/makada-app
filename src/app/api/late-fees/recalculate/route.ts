import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateLateFee, getCurrentPeriod } from "@/lib/late-fees";

export const dynamic = "force-dynamic";

/**
 * POST /api/late-fees/recalculate
 * Recalculates late fees for all active leases for the current period
 * and any past unpaid periods. Should be called daily (via cron or manually).
 */
export async function POST() {
  try {
    const currentPeriod = getCurrentPeriod();

    // Get all active leases
    const leases = await prisma.lease.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        lateFeePerDay: true,
        rentDueDay: true,
        gracePeriodDays: true,
        monthlyRent: true,
        startDate: true,
        paymentStatuses: {
          where: {
            status: { not: "PAID" },
            lateFeeWaived: false,
          },
        },
      },
    });

    let updated = 0;

    for (const lease of leases) {
      // Generate periods from lease start to current period
      const leaseStartPeriod = `${lease.startDate.getFullYear()}-${String(lease.startDate.getMonth() + 1).padStart(2, "0")}`;

      // Check current period and any unpaid past periods
      const periodsToCheck = new Set<string>();
      periodsToCheck.add(currentPeriod);

      // Add any existing unpaid periods
      for (const ps of lease.paymentStatuses) {
        periodsToCheck.add(ps.period);
      }

      for (const period of periodsToCheck) {
        // Skip periods before lease started
        if (period < leaseStartPeriod) continue;

        const existingStatus = lease.paymentStatuses.find(
          (ps) => ps.period === period
        );

        const lateFee = calculateLateFee({
          period,
          rentPaidAt: null, // unpaid
          lateFeePerDay: Number(lease.lateFeePerDay),
          rentDueDay: lease.rentDueDay,
          gracePeriodDays: lease.gracePeriodDays,
        });

        if (lateFee > 0) {
          if (existingStatus) {
            // Update existing record
            await prisma.paymentStatus.update({
              where: { id: existingStatus.id },
              data: {
                lateFeeAccrued: lateFee,
                status: "BEHIND",
              },
            });
          } else {
            // Create new payment status for this period
            await prisma.paymentStatus.upsert({
              where: {
                leaseId_period: { leaseId: lease.id, period },
              },
              create: {
                leaseId: lease.id,
                period,
                status: "BEHIND",
                lateFeeAccrued: lateFee,
              },
              update: {
                lateFeeAccrued: lateFee,
                status: "BEHIND",
              },
            });
          }
          updated++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      leasesChecked: leases.length,
      periodsUpdated: updated,
    });
  } catch (err) {
    console.error("[late-fees] recalculate error:", err);
    return NextResponse.json(
      { error: "Failed to recalculate late fees" },
      { status: 500 }
    );
  }
}
