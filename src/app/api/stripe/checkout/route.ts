import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout Session for a tenant to pay rent.
 * Body: { leaseId: string, period: string }
 *
 * Called from the tenant portal (or admin app) to initiate payment.
 */
export async function POST(req: NextRequest) {
  try {
    const { leaseId, period } = await req.json();

    if (!leaseId || !period) {
      return NextResponse.json({ error: "leaseId and period are required" }, { status: 400 });
    }

    // Get lease with tenant and unit details
    const lease = await prisma.lease.findUnique({
      where: { id: leaseId },
      include: {
        tenant: true,
        unit: {
          include: { property: true },
        },
      },
    });

    if (!lease) {
      return NextResponse.json({ error: "Lease not found" }, { status: 404 });
    }

    const amount = Number(lease.monthlyRent);
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid rent amount" }, { status: 400 });
    }

    // Format period for display
    const [year, month] = period.split("-");
    const periodDate = new Date(Number(year), Number(month) - 1);
    const periodLabel = periodDate.toLocaleString("en-US", { month: "long", year: "numeric" });

    // Determine return URLs
    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: Math.round(amount * 100), // Stripe uses cents
            product_data: {
              name: `Rent — ${periodLabel}`,
              description: `${lease.unit.property.name} · ${lease.unit.label}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        leaseId,
        period,
        tenantId: lease.tenantId,
        unitLabel: lease.unit.label,
        propertyName: lease.unit.property.name,
      },
      customer_email: lease.tenant.email || undefined,
      success_url: `${origin}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/payments?canceled=true`,
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
