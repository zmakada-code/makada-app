/**
 * Adds the new payment fields to the PaymentStatus table
 * (method, amountPaid, stripeSessionId, paidAt) and creates the PaymentMethod enum.
 *
 * Run: node add-payment-fields.mjs
 */
import pg from "pg";
const { Client } = pg;

const DATABASE_URL =
  "postgresql://postgres.qitktpzegtpjkpjdkjka:TRjCT4IryUbyacZl@aws-1-us-east-2.pooler.supabase.com:5432/postgres";

const client = new Client({ connectionString: DATABASE_URL });

async function main() {
  await client.connect();
  console.log("🔧 Connected.\n");

  // Create the PaymentMethod enum if it doesn't exist
  console.log("── Creating PaymentMethod enum ──");
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE "PaymentMethod" AS ENUM ('ONLINE', 'CHECK', 'CASH', 'OTHER');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);
  console.log("  ✓ PaymentMethod enum ready");

  // Add new columns to PaymentStatus
  console.log("\n── Adding new columns to PaymentStatus ──");

  const columns = [
    { name: "method", sql: `ALTER TABLE "PaymentStatus" ADD COLUMN IF NOT EXISTS "method" "PaymentMethod"` },
    { name: "amountPaid", sql: `ALTER TABLE "PaymentStatus" ADD COLUMN IF NOT EXISTS "amountPaid" DECIMAL(10,2)` },
    { name: "stripeSessionId", sql: `ALTER TABLE "PaymentStatus" ADD COLUMN IF NOT EXISTS "stripeSessionId" TEXT` },
    { name: "paidAt", sql: `ALTER TABLE "PaymentStatus" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMPTZ` },
  ];

  for (const col of columns) {
    await client.query(col.sql);
    console.log(`  ✓ ${col.name} column ready`);
  }

  console.log("\n✅ Done. PaymentStatus table updated with Stripe fields.");
}

main()
  .catch((e) => { console.error("❌ Failed:", e); process.exit(1); })
  .finally(() => client.end());
