/**
 * Migration: Add lease signing workflow columns to Lease table.
 * Run: node add-lease-signing.mjs
 *
 * Adds: signingStatus, leaseDocStoragePath, signedDocStoragePath,
 *        sentForSigningAt, signedAt
 */

import pg from "pg";
const { Client } = pg;

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres.qitktpzegtpjkpjdkjka:TRjCT4IryUbyacZl@aws-1-us-east-2.pooler.supabase.com:5432/postgres";

async function run() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log("Connected.");

  const columns = [
    { name: "signingStatus", sql: 'ALTER TABLE "Lease" ADD COLUMN "signingStatus" TEXT' },
    { name: "leaseDocStoragePath", sql: 'ALTER TABLE "Lease" ADD COLUMN "leaseDocStoragePath" TEXT' },
    { name: "signedDocStoragePath", sql: 'ALTER TABLE "Lease" ADD COLUMN "signedDocStoragePath" TEXT' },
    { name: "sentForSigningAt", sql: 'ALTER TABLE "Lease" ADD COLUMN "sentForSigningAt" TIMESTAMPTZ' },
    { name: "signedAt", sql: 'ALTER TABLE "Lease" ADD COLUMN "signedAt" TIMESTAMPTZ' },
  ];

  for (const col of columns) {
    const exists = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'Lease' AND column_name = $1`,
      [col.name]
    );
    if (exists.rows.length > 0) {
      console.log(`Column ${col.name} already exists. Skipping.`);
    } else {
      await client.query(col.sql);
      console.log(`Added column: ${col.name}`);
    }
  }

  console.log("Done.");
  await client.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
