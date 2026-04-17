/**
 * Creates a Document record for the Marco Varni & Michelle Blackwell lease
 * at 1110 Haddon Drive, Unit 4.
 *
 * Run: node upload-haddon-lease.mjs
 */
import pg from "pg";
const { Client } = pg;

const DATABASE_URL =
  "postgresql://postgres.qitktpzegtpjkpjdkjka:TRjCT4IryUbyacZl@aws-1-us-east-2.pooler.supabase.com:5432/postgres";

const client = new Client({ connectionString: DATABASE_URL });

function cuid() {
  return "c" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function main() {
  await client.connect();
  console.log("🔧 Connected.\n");

  // Find Unit 4 at Haddon Drive
  const unit = await client.query(`
    SELECT u.id, u.label, p.name, p.id as "propertyId"
    FROM "Unit" u
    JOIN "Property" p ON u."propertyId" = p.id
    WHERE u.label LIKE '%4%' AND p.name LIKE '%Haddon%'
    LIMIT 1
  `);

  if (unit.rows.length === 0) {
    console.log("❌ Could not find Unit 4 at Haddon Drive");
    return;
  }

  const u = unit.rows[0];
  console.log(`Found: ${u.name} — ${u.label} (${u.id})`);

  // Check if lease document already exists
  const existing = await client.query(
    `SELECT id FROM "Document" WHERE "linkedEntityId" = $1 AND type = 'LEASE'`,
    [u.id]
  );

  if (existing.rows.length > 0) {
    console.log("  – Lease document already exists for this unit");
    return;
  }

  // Create the document record
  const docId = cuid();
  await client.query(
    `INSERT INTO "Document" (id, filename, "fileUrl", "storagePath", type, "linkedEntityType", "linkedEntityId", "uploadedAt")
     VALUES ($1, $2, $3, $4, 'LEASE'::"DocumentType", 'UNIT'::"LinkedEntityType", $5, NOW())`,
    [
      docId,
      "Marco Varni & Michelle Blackwell 1110 Haddon Drive Apt 4 Lease.pdf",
      "documents/haddon-unit4-lease-varni-blackwell.pdf",
      "documents/haddon-unit4-lease-varni-blackwell.pdf",
      u.id,
    ]
  );
  console.log("✓ Lease document record created for Marco Varni & Michelle Blackwell at Haddon Unit 4");

  console.log("\n✅ Done.");
}

main()
  .catch((e) => { console.error("❌ Failed:", e); process.exit(1); })
  .finally(() => client.end());
