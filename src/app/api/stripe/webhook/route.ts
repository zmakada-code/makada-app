import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

/**
 * POST /api/stripe/webhook
 * Stripe webhook endpoint — handles checkout.session.completed events.
 * When a tenant completes a Stripe checkout, this marks their payment as PAID.
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { leaseId, period } = session.metadata || {};

    if (leaseId && period) {
      try {
        await prisma.paymentStatus.upsert({
          where: { leaseId_period: { leaseId, period } },
          update: {
            status: "PAID",
            method: "ONLINE",
            amountPaid: session.amount_total ? session.amount_total / 100 : null,
            stripeSessionId: session.id,
            paidAt: new Date(),
            note: `Stripe payment — ${session.payment_intent}`,
          },
          create: {
            leaseId,
            period,
            status: "PAID",
            method: "ONLINE",
            amountPaid: session.amount_total ? session.amount_total / 100 : null,
            stripeSessionId: session.id,
            paidAt: new Date(),
            note: `Stripe payment — ${session.payment_intent}`,
          },
        });
        console.log(`✅ Payment recorded: lease ${leaseId}, period ${period}`);
      } catch (err) {
        console.error("Failed to update payment status:", err);
      }
    }
  }

  return NextResponse.json({ received: true });
}

// Stripe webhooks need the raw body, so disable body parsing
export const runtime = "nodejs";
