import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { createReceiptDocument } from "@/lib/create-receipt-document";
import { createFeeReceiptDocument } from "@/lib/create-fee-receipt-document";
import Stripe from "stripe";

/**
 * POST /api/stripe/webhook
 * Stripe webhook endpoint — handles checkout.session.completed events.
 * Supports three payment types via metadata.type:
 *   - rent (default, no type field): marks PaymentStatus as PAID
 *   - fee: marks Fee as PAID
 *   - deposit: records deposit payment on Lease
 * All types auto-generate receipt PDFs stored in Supabase.
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = session.metadata || {};
    const paymentType = meta.type || "rent"; // default to rent for backward compatibility

    try {
      if (paymentType === "fee" && meta.feeId) {
        // ── Custom fee payment ──
        const fee = await prisma.fee.findUnique({ where: { id: meta.feeId } });
        if (fee && fee.paidStatus !== "PAID") {
          await prisma.fee.update({
            where: { id: meta.feeId },
            data: {
              paidStatus: "PAID",
              paidAmount: session.amount_total ? session.amount_total / 100 : Number(fee.amount),
              paidAt: new Date(),
              paymentMethod: "ONLINE",
              stripeSessionId: session.id,
              note: `Stripe payment — ${session.payment_intent}`,
            },
          });
          console.log(`✅ Fee payment recorded: ${fee.name} (${meta.feeId})`);

          // Generate receipt
          await createFeeReceiptDocument(meta.feeId);
        }
      } else if (paymentType === "deposit" && meta.leaseId) {
        // ── Security deposit payment ──
        const lease = await prisma.lease.findUnique({
          where: { id: meta.leaseId },
          include: { unit: true },
        });

        if (lease) {
          const depositRequired = Number(lease.depositAmount ?? lease.unit.depositAmount ?? 0);
          const existingPaid = Number(lease.depositPaidAmount ?? 0);
          const newPayment = session.amount_total ? session.amount_total / 100 : 0;
          const totalPaid = existingPaid + newPayment;
          const isFullyPaid = totalPaid >= depositRequired;

          await prisma.lease.update({
            where: { id: meta.leaseId },
            data: {
              depositStatus: isFullyPaid ? "PAID" : "PARTIAL",
              depositPaidAmount: totalPaid,
              depositPaidAt: new Date(),
              depositPaymentMethod: "ONLINE",
              depositStripeSessionId: session.id,
              depositNote: `Stripe payment — ${session.payment_intent}`,
            },
          });
          console.log(`✅ Deposit payment recorded: lease ${meta.leaseId}, amount $${newPayment}`);

          // Generate receipt
          await createFeeReceiptDocument(null, meta.leaseId, "deposit", newPayment);
        }
      } else {
        // ── Rent payment (original flow) ──
        const { leaseId, period } = meta;
        if (leaseId && period) {
          const payment = await prisma.paymentStatus.upsert({
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

          // Auto-generate receipt document
          await createReceiptDocument(payment.id);
        }
      }
    } catch (err) {
      console.error("Failed to process payment:", err);
    }
  }

  return NextResponse.json({ received: true });
}

export const runtime = "nodejs";
