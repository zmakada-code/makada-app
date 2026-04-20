-- ============================================================
-- Migration: Fees, Deposits, Late Fee tracking
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Lease: Security deposit tracking fields
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "depositAmount" DECIMAL(10, 2);
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "depositStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "depositPaidAmount" DECIMAL(10, 2);
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "depositPaidAt" TIMESTAMPTZ;
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "depositPaymentMethod" TEXT;
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "depositStripeSessionId" TEXT;
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "depositNote" TEXT;

-- 2. Lease: Late fee settings
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "lateFeePerDay" DECIMAL(10, 2) NOT NULL DEFAULT 10;
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "rentDueDay" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "gracePeriodDays" INTEGER NOT NULL DEFAULT 0;

-- 3. PaymentStatus: Late fee tracking
ALTER TABLE "PaymentStatus" ADD COLUMN IF NOT EXISTS "lateFeeAccrued" DECIMAL(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE "PaymentStatus" ADD COLUMN IF NOT EXISTS "lateFeePaid" DECIMAL(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE "PaymentStatus" ADD COLUMN IF NOT EXISTS "lateFeeWaived" BOOLEAN NOT NULL DEFAULT false;

-- 4. Fee table (custom fees per lease)
CREATE TABLE IF NOT EXISTS "Fee" (
  "id" TEXT NOT NULL,
  "leaseId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "amount" DECIMAL(10, 2) NOT NULL,
  "isRecurring" BOOLEAN NOT NULL DEFAULT false,
  "dueDate" TIMESTAMPTZ,
  "paidStatus" TEXT NOT NULL DEFAULT 'UNPAID',
  "paidAmount" DECIMAL(10, 2),
  "paidAt" TIMESTAMPTZ,
  "paymentMethod" TEXT,
  "stripeSessionId" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "Fee_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Fee_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes for Fee table
CREATE INDEX IF NOT EXISTS "Fee_leaseId_idx" ON "Fee"("leaseId");
CREATE INDEX IF NOT EXISTS "Fee_paidStatus_idx" ON "Fee"("paidStatus");
