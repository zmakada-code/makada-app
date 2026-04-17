/**
 * Remove orphaned tenants (no leases attached).
 * Run: node fix-orphans.mjs
 */
import pg from "pg";
const { Client } = pg;
const DATABASE_URL = "postgresql://postgres.qitktpzegtpjkpjdkjka:TRjCT4IryUbyacZl@aws-1-us-east-2.pooler.supabase.com:5432/postgres";
const client = new Client({ connectionString: DATABASE_URL });

async function main() {
  await client.connect();
  console.log("🔧 Removing orphaned tenants…\n");

  const orphans = await client.query(`
    SELECT t.id, t."fullName"
    FROM "Tenant" t
    LEFT JOIN "Lease" l ON l."tenantId" = t.id
    WHERE l.id IS NULL
  `);

  for (const t of orphans.rows) {
    await client.query(`DELETE FROM "MaintenanceTicket" WHERE "tenantId" = $1`, [t.id]);
    await client.query(`DELETE FROM "Tenant" WHERE id = $1`, [t.id]);
    console.log(`  ✓ Removed: ${t.fullName}`);
  }

  const count = await client.query(`SELECT COUNT(*) FROM "Tenant"`);
  console.log(`\n✅ Done. ${count.rows[0].count} tenants remaining.`);
}

main().catch(e => { console.error("❌", e); process.exit(1); }).finally(() => client.end());
