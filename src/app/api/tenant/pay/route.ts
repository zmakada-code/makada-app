import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/tenant/pay
 * Creates a Stripe Checkout Session for a tenant to pay rent.
 * Called from the tenant portal with x-intake-secret header.
 * Body: { authUserId: string, period: string, returnUrl: string }
 */
export async function POST(req: NextRequest) {
  // Verify the intake secret
  const secret = req.headers.get("x-intake-secret");
  if (secret !== process.env.INQUIRY_INTAKE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { authUserId, period, returnUrl } = await req.json();

    if (!authUserId || !period) {
      return NextResponse.json({ error: "authUserId and period are required" }, { status: 400 });
    }

    // Find the tenant by their auth user ID
    const tenant = await prisma.tenant.findFirst({
      where: { authUserId },
      include: {
        leases: {
          where: { status: "ACTIVE" },
          include: {
            unit: { include: { property: true } },
          },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const lease = tenant.leases[0];
    if (!lease) {
      return NextResponse.json({ error: "No active lease found" }, { status: 404 });
    }

    const amount = Number(lease.monthlyRent);
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid rent amount" }, { status: 400 });
    }

    // Format period for display
    const [year, month] = period.split("-");
    const periodDate = new Date(Number(year), Number(month) - 1);
    const periodLabel = periodDate.toLocaleString("en-US", { month: "long", year: "numeric" });

    const baseReturnUrl = returnUrl || "https://zmak-zmakada.replit.app";

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: `Rent — ${periodLabel}`,
              description: `${lease.unit.property.name} · ${lease.unit.label}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        leaseId: lease.id,
        period,
        tenantId: tenant.id,
        unitLabel: lease.unit.label,
        propertyName: lease.unit.property.name,
      },
      customer_email: tenant.email || undefined,
      success_url: `${baseReturnUrl}/dashboard?payment=success`,
      cancel_url: `${baseReturnUrl}/dashboard?payment=canceled`,
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("Tenant pay error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
