/**
 * Adds the imageUrl column to the Property table.
 * Run: node add-property-image.mjs
 */
import pg from "pg";
const { Client } = pg;

const DATABASE_URL =
  "postgresql://postgres.qitktpzegtpjkpjdkjka:TRjCT4IryUbyacZl@aws-1-us-east-2.pooler.supabase.com:5432/postgres";

const client = new Client({ connectionString: DATABASE_URL });

async function main() {
  await client.connect();
  console.log("Connected.\n");

  // Check if column already exists
  const { rows } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'Property' AND column_name = 'imageUrl'
  `);

  if (rows.length > 0) {
    console.log("Column imageUrl already exists on Property.");
  } else {
    await client.query(`ALTER TABLE "Property" ADD COLUMN "imageUrl" TEXT`);
    console.log("✅ Added imageUrl column to Property table.");
  }

  // Also add leaseType to Lease table if it doesn't exist
  const { rows: leaseTypeCols } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'Lease' AND column_name = 'leaseType'
  `);
  if (leaseTypeCols.length === 0) {
    await client.query(`ALTER TABLE "Lease" ADD COLUMN "leaseType" TEXT DEFAULT 'YEAR_TO_YEAR'`);
    console.log("✅ Added leaseType column to Lease table.");
  } else {
    console.log("Column leaseType already exists on Lease.");
  }

  // Show current properties
  const { rows: props } = await client.query(`SELECT id, name, address, "imageUrl" FROM "Property"`);
  console.log(`\nCurrent properties (${props.length}):`);
  for (const p of props) {
    console.log(`  ${p.name} — ${p.address} (image: ${p.imageUrl ?? "none"})`);
  }
}

main()
  .catch((e) => { console.error("Failed:", e); process.exit(1); })
  .finally(() => client.end());
