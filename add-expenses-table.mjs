/**
 * Creates the Expense table and ExpenseCategory enum.
 * Also adds INVOICE, TAX, INSURANCE to the DocumentType enum.
 *
 * Run: node add-expenses-table.mjs
 */
import pg from "pg";
const { Client } = pg;

const DATABASE_URL =
  "postgresql://postgres.qitktpzegtpjkpjdkjka:TRjCT4IryUbyacZl@aws-1-us-east-2.pooler.supabase.com:5432/postgres";

const client = new Client({ connectionString: DATABASE_URL });

async function main() {
  await client.connect();
  console.log("🔧 Connected.\n");

  // ── Add new DocumentType enum values ──
  console.log("── Updating DocumentType enum ──");
  for (const val of ["INVOICE", "TAX", "INSURANCE"]) {
    await client.query(`
      DO $$ BEGIN
        ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS '${val}';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    console.log(`  ✓ ${val} added to DocumentType`);
  }

  // ── Create ExpenseCategory enum ──
  console.log("\n── Creating ExpenseCategory enum ──");
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE "ExpenseCategory" AS ENUM (
        'REPAIRS', 'MAINTENANCE', 'MANAGEMENT_FEE', 'PROPERTY_TAX',
        'INSURANCE', 'UTILITIES', 'LANDSCAPING', 'CLEANING',
        'PEST_CONTROL', 'LEGAL', 'SUPPLIES', 'OTHER'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  console.log("  ✓ ExpenseCategory enum ready");

  // ── Create Expense table ──
  console.log("\n── Creating Expense table ──");
  await client.query(`
    CREATE TABLE IF NOT EXISTS "Expense" (
      id            TEXT PRIMARY KEY,
      "propertyId"  TEXT NOT NULL REFERENCES "Property"(id) ON DELETE CASCADE,
      "unitId"      TEXT REFERENCES "Unit"(id) ON DELETE SET NULL,
      category      "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
      vendor        TEXT,
      description   TEXT NOT NULL,
      amount        DECIMAL(10,2) NOT NULL,
      date          TIMESTAMPTZ NOT NULL,
      reference     TEXT,
      "documentId"  TEXT,
      note          TEXT,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log("  ✓ Expense table created");

  // ── Create indexes ──
  console.log("\n── Creating indexes ──");
  await client.query(`CREATE INDEX IF NOT EXISTS "Expense_propertyId_idx" ON "Expense"("propertyId")`);
  await client.query(`CREATE INDEX IF NOT EXISTS "Expense_unitId_idx" ON "Expense"("unitId")`);
  await client.query(`CREATE INDEX IF NOT EXISTS "Expense_date_idx" ON "Expense"(date)`);
  console.log("  ✓ Indexes created");

  console.log("\n✅ Done. Expense tracking is ready.");
}

main()
  .catch((e) => { console.error("❌ Failed:", e); process.exit(1); })
  .finally(() => client.end());
