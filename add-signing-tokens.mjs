/**
 * Migration: Add signing_tokens table for email-based lease signing.
 *
 * Usage: node add-signing-tokens.mjs
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

  // Create signing_tokens table
  await client.query(`
    CREATE TABLE IF NOT EXISTS "SigningToken" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "token" TEXT NOT NULL UNIQUE,
      "leaseId" TEXT NOT NULL REFERENCES "Lease"("id") ON DELETE CASCADE,
      "email" TEXT NOT NULL,
      "tenantName" TEXT NOT NULL,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "usedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("✅ SigningToken table created.");

  // Create index on token for fast lookup
  await client.query(`
    CREATE INDEX IF NOT EXISTS "SigningToken_token_idx" ON "SigningToken"("token");
  `);
  console.log("✅ Token index created.");

  await client.end();
  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
