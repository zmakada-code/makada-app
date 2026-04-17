/**
 * Removes the test property, unit, tenant, lease, and payment records.
 * Run: node delete-test-property.mjs
 */
import pg from "pg";
const { Client } = pg;

const DATABASE_URL =
  "postgresql://postgres.qitktpzegtpjkpjdkjka:TRjCT4IryUbyacZl@aws-1-us-east-2.pooler.supabase.com:5432/postgres";

const client = new Client({ connectionString: DATABASE_URL });

async function main() {
  await client.connect();
  console.log("🔧 Connected.\n");

  // Find test property
  const prop = await client.query(
    `SELECT id FROM "Property" WHERE name = 'Test Property' AND address LIKE '%123 Test Street%'`
  );

  if (prop.rows.length === 0) {
    console.log("No test property found. Nothing to delete.");
    return;
  }

  const propertyId = prop.rows[0].id;

  // Find test tenant
  const tenant = await client.query(
    `SELECT id FROM "Tenant" WHERE "fullName" = 'Zain Makada' AND notes LIKE '%TEST%'`
  );

  // Cascade deletes will handle leases, payments, units
  await client.query(`DELETE FROM "Property" WHERE id = $1`, [propertyId]);
  console.log("✓ Deleted Test Property (cascaded: units, leases, payments)");

  if (tenant.rows.length > 0) {
    await client.query(`DELETE FROM "Tenant" WHERE id = $1`, [tenant.rows[0].id]);
    console.log("✓ Deleted Zain Makada test tenant");
  }

  console.log("\n✅ Test data cleaned up.");
}

main()
  .catch((e) => { console.error("❌ Failed:", e); process.exit(1); })
  .finally(() => client.end());
