import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

const ACH_FEE_CENTS = 300; // $3.00 ACH convenience fee

/**
 * POST /api/tenant/pay
 * Creates a Stripe Checkout Session for a tenant to pay rent.
 * Called from the tenant portal with x-intake-secret header.
 * Body: { authUserId: string, period: string, returnUrl: string, paymentMethod: "card" | "bank" }
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-intake-secret");
  if (secret !== process.env.INQUIRY_INTAKE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { authUserId, period, returnUrl } = await req.json();

    if (!authUserId || !period) {
      return NextResponse.json({ error: "authUserId and period are required" }, { status: 400 });
    }

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

    const [year, month] = period.split("-");
    const periodDate = new Date(Number(year), Number(month) - 1);
    const periodLabel = periodDate.toLocaleString("en-US", { month: "long", year: "numeric" });

    const baseReturnUrl = returnUrl || "https://tenant.mzancapital.com";

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["us_bank_account"],
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
        {
          price_data: {
            currency: "usd",
            unit_amount: ACH_FEE_CENTS,
            product_data: {
              name: "Processing fee ($3.00)",
              description: "Online payment processing fee",
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
        paymentMethod: "bank",
        baseAmount: String(amount),
      },
      customer_email: tenant.email || undefined,
      success_url: `${baseReturnUrl}/tenant/payments?payment=success`,
      cancel_url: `${baseReturnUrl}/tenant/payments?payment=canceled`,
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("Tenant pay error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
