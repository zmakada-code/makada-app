import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

const ACH_FEE_CENTS = 300; // $3.00 ACH convenience fee

/**
 * POST /api/tenant/pay-fee
 * Creates a Stripe Checkout Session for a tenant to pay a custom fee or security deposit.
 * Called from the tenant portal with x-intake-secret header.
 * Body: { authUserId: string, type: "fee" | "deposit", feeId?: string, paymentMethod?: "card" | "bank", returnUrl?: string }
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-intake-secret");
  if (secret !== process.env.INQUIRY_INTAKE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { authUserId, type, feeId, returnUrl } = await req.json();

    if (!authUserId || !type) {
      return NextResponse.json({ error: "authUserId and type are required" }, { status: 400 });
    }

    // Find the tenant
    const tenant = await prisma.tenant.findFirst({
      where: { authUserId },
      include: {
        leases: {
          where: { status: "ACTIVE" },
          include: {
            unit: { include: { property: true } },
            fees: true,
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

    const baseReturnUrl = returnUrl || "https://tenant.mzancapital.com";
    let productName: string;
    let productDescription: string;
    let amount: number;
    let metadata: Record<string, string>;

    if (type === "deposit") {
      // Security deposit payment
      const depositRequired = Number(lease.depositAmount ?? lease.unit.depositAmount ?? 0);
      const depositPaid = Number(lease.depositPaidAmount ?? 0);
      amount = depositRequired - depositPaid;

      if (amount <= 0) {
        return NextResponse.json({ error: "Security deposit is already paid" }, { status: 400 });
      }

      productName = "Security Deposit";
      productDescription = `${lease.unit.property.name} · ${lease.unit.label}`;
      metadata = {
        type: "deposit",
        leaseId: lease.id,
        tenantId: tenant.id,
        unitLabel: lease.unit.label,
        propertyName: lease.unit.property.name,
      };
    } else if (type === "fee" && feeId) {
      // Custom fee payment (pet fee, parking, etc.)
      const fee = lease.fees.find((f) => f.id === feeId);
      if (!fee) {
        return NextResponse.json({ error: "Fee not found on this lease" }, { status: 404 });
      }
      if (fee.paidStatus === "PAID" || fee.paidStatus === "WAIVED") {
        return NextResponse.json({ error: "Fee is already settled" }, { status: 400 });
      }

      const alreadyPaid = fee.paidAmount ? Number(fee.paidAmount) : 0;
      amount = Number(fee.amount) - alreadyPaid;

      if (amount <= 0) {
        return NextResponse.json({ error: "Fee is already paid" }, { status: 400 });
      }

      productName = fee.name;
      productDescription = `${lease.unit.property.name} · ${lease.unit.label}`;
      metadata = {
        type: "fee",
        feeId: fee.id,
        leaseId: lease.id,
        tenantId: tenant.id,
        unitLabel: lease.unit.label,
        propertyName: lease.unit.property.name,
      };
    } else {
      return NextResponse.json({ error: "Invalid payment type" }, { status: 400 });
    }

    metadata.paymentMethod = "bank";
    metadata.baseAmount = String(amount);

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["us_bank_account"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: productName,
              description: productDescription,
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
      metadata,
      customer_email: tenant.email || undefined,
      success_url: `${baseReturnUrl}/tenant/payments?payment=success&type=${type}`,
      cancel_url: `${baseReturnUrl}/tenant/payments?payment=canceled`,
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("Tenant pay-fee error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
