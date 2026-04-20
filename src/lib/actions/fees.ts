"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function flash(path: string, message: string, type: "success" | "error" = "success") {
  const qs = new URLSearchParams({ flash: message, flashType: type }).toString();
  return `${path}?${qs}`;
}

/**
 * Add a fee to a lease.
 */
export async function addFee(formData: FormData) {
  const leaseId = formData.get("leaseId")?.toString();
  const name = formData.get("name")?.toString()?.trim();
  const amountStr = formData.get("amount")?.toString();
  const isRecurring = formData.get("isRecurring") === "true";
  const dueDateStr = formData.get("dueDate")?.toString();
  const note = formData.get("note")?.toString()?.trim() || null;

  if (!leaseId || !name || !amountStr) {
    return;
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) return;

  const dueDate = dueDateStr ? new Date(dueDateStr) : null;

  await prisma.fee.create({
    data: {
      leaseId,
      name,
      amount,
      isRecurring,
      dueDate,
      note,
    },
  });

  revalidatePath(`/leases/${leaseId}/edit`);
  revalidatePath("/payments");
  redirect(flash(`/leases/${leaseId}/edit`, `Fee "${name}" added.`));
}

/**
 * Mark a fee as paid (manual recording).
 */
export async function markFeePaid(formData: FormData) {
  const feeId = formData.get("feeId")?.toString();
  const method = formData.get("method")?.toString() || "OTHER";
  const amountStr = formData.get("amount")?.toString();
  const note = formData.get("note")?.toString()?.trim() || null;

  if (!feeId) return;

  const fee = await prisma.fee.findUnique({ where: { id: feeId } });
  if (!fee) return;

  const paidAmount = amountStr ? parseFloat(amountStr) : Number(fee.amount);
  const isFullyPaid = paidAmount >= Number(fee.amount);

  await prisma.fee.update({
    where: { id: feeId },
    data: {
      paidStatus: isFullyPaid ? "PAID" : "PARTIAL",
      paidAmount,
      paidAt: new Date(),
      paymentMethod: method,
      note,
    },
  });

  revalidatePath(`/leases/${fee.leaseId}/edit`);
  revalidatePath("/payments");
}

/**
 * Waive a fee.
 */
export async function waiveFee(formData: FormData) {
  const feeId = formData.get("feeId")?.toString();
  if (!feeId) return;

  const fee = await prisma.fee.findUnique({ where: { id: feeId } });
  if (!fee) return;

  await prisma.fee.update({
    where: { id: feeId },
    data: { paidStatus: "WAIVED" },
  });

  revalidatePath(`/leases/${fee.leaseId}/edit`);
  revalidatePath("/payments");
}

/**
 * Delete a fee.
 */
export async function deleteFee(formData: FormData) {
  const feeId = formData.get("feeId")?.toString();
  if (!feeId) return;

  const fee = await prisma.fee.findUnique({ where: { id: feeId } });
  if (!fee) return;

  await prisma.fee.delete({ where: { id: feeId } });

  revalidatePath(`/leases/${fee.leaseId}/edit`);
  revalidatePath("/payments");
}

/**
 * Record a security deposit payment.
 */
export async function recordDepositPayment(formData: FormData) {
  const leaseId = formData.get("leaseId")?.toString();
  const method = formData.get("method")?.toString() || "OTHER";
  const amountStr = formData.get("amount")?.toString();
  const note = formData.get("note")?.toString()?.trim() || null;

  if (!leaseId) return;

  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: { unit: true },
  });
  if (!lease) return;

  const depositRequired = Number(lease.depositAmount ?? lease.unit.depositAmount);
  const paidAmount = amountStr ? parseFloat(amountStr) : depositRequired;
  const isFullyPaid = paidAmount >= depositRequired;

  await prisma.lease.update({
    where: { id: leaseId },
    data: {
      depositStatus: isFullyPaid ? "PAID" : "PARTIAL",
      depositPaidAmount: paidAmount,
      depositPaidAt: new Date(),
      depositPaymentMethod: method,
      depositNote: note,
    },
  });

  revalidatePath(`/leases/${leaseId}/edit`);
  revalidatePath("/payments");
  redirect(flash(`/leases/${leaseId}/edit`, "Security deposit payment recorded."));
}

/**
 * Waive late fee for a specific payment period.
 */
export async function waiveLateFee(formData: FormData) {
  const paymentStatusId = formData.get("paymentStatusId")?.toString();
  if (!paymentStatusId) return;

  await prisma.paymentStatus.update({
    where: { id: paymentStatusId },
    data: { lateFeeWaived: true, lateFeeAccrued: 0 },
  });

  revalidatePath("/payments");
}
