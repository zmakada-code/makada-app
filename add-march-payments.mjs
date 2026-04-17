/**
 * Adds March 2026 payment records for 500 N San Mateo tenants
 * and updates Unit 101 notes with Caminar eviction + lock work order.
 *
 * Run: node add-march-payments.mjs
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

  // ── Add March 2026 payment records for all active leases ──
  console.log("── Adding March 2026 payments ──");

  const activeLeases = await client.query(`
    SELECT l.id as lease_id, t."fullName", u.label, p.name as property
    FROM "Lease" l
    JOIN "Tenant" t ON l."tenantId" = t.id
    JOIN "Unit" u ON l."unitId" = u.id
    JOIN "Property" p ON u."propertyId" = p.id
    WHERE l.status = 'ACTIVE'
    ORDER BY p.name, u.label
  `);

  for (const lease of activeLeases.rows) {
    // Check if March 2026 payment already exists
    const existing = await client.query(
      `SELECT id FROM "PaymentStatus" WHERE "leaseId" = $1 AND period = '2026-03'`,
      [lease.lease_id]
    );

    if (existing.rows.length === 0) {
      const id = cuid();
      await client.query(
        `INSERT INTO "PaymentStatus" (id, "leaseId", period, status, "createdAt", "updatedAt")
         VALUES ($1, $2, '2026-03', 'PAID'::"PaymentState", NOW(), NOW())`,
        [id, lease.lease_id]
      );
      console.log(`  ✓ ${lease.property} · ${lease.label} — ${lease.fullName} — March PAID`);
    } else {
      console.log(`  – ${lease.property} · ${lease.label} — already has March record`);
    }
  }

  // ── Update Unit 101 notes with Caminar/eviction + lock work order ──
  console.log("\n── Updating Unit 101 notes ──");
  await client.query(`
    UPDATE "Unit" SET
      notes = $1,
      "updatedAt" = NOW()
    WHERE label = 'Unit 101'
      AND "propertyId" = (SELECT id FROM "Property" WHERE name LIKE '%San Mateo%' LIMIT 1)
  `, [
    "Downstairs 1st building 1st left. Gut job — need to get out. " +
    "Previously occupied by Caminar, Inc (eviction status). Roxanne Richards paid rent. " +
    "Move-in 07/09/2013. Deposit $1,595. " +
    "Caminar paid $2,125 for Oct 2025 back rent + $125 repair (lock set) in March 2026. " +
    "Work Order #4990-1 (03/19/2026): R/R Lockset & Mailbox Lock — $161.85 ($95 labor + $66.85 materials). " +
    "Unit now vacant (Vacant-Unrented as of April 2026)."
  ]);
  console.log("  ✓ Unit 101 notes updated");

  // ── Update Unit 104 lease dates (renewed 03/15/2026 to 03/14/2027) ──
  console.log("\n── Updating Unit 104 lease ──");
  await client.query(`
    UPDATE "Lease" SET
      "startDate" = '2026-03-15',
      "endDate" = '2027-03-14',
      notes = 'Lease renewed 03/15/2026 to 03/14/2027. Previously moved in 09/01/2024. Gracerela Flores also pays partial rent and $200/mo garage rent for this unit.',
      "updatedAt" = NOW()
    WHERE "unitId" = (
      SELECT u.id FROM "Unit" u
      JOIN "Property" p ON u."propertyId" = p.id
      WHERE u.label = 'Unit 104' AND p.name LIKE '%San Mateo%'
    )
  `);
  console.log("  ✓ Unit 104 lease updated to 03/15/2026 – 03/14/2027");

  // ── Final count ──
  const payCount = await client.query(`SELECT COUNT(*) FROM "PaymentStatus"`);
  console.log(`\n✅ Done. ${payCount.rows[0].count} total payment records.`);
}

main()
  .catch((e) => { console.error("❌ Failed:", e); process.exit(1); })
  .finally(() => client.end());
