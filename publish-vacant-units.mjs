/**
 * Publishes all vacant units so they appear on the tenant portal's
 * Available Properties page.
 *
 * Run: node publish-vacant-units.mjs
 */
import pg from "pg";
const { Client } = pg;

const DATABASE_URL =
  "postgresql://postgres.qitktpzegtpjkpjdkjka:TRjCT4IryUbyacZl@aws-1-us-east-2.pooler.supabase.com:5432/postgres";

const client = new Client({ connectionString: DATABASE_URL });

async function main() {
  await client.connect();
  console.log("Connected.\n");

  // Find all vacant units
  const { rows: vacantUnits } = await client.query(`
    SELECT u.id, u.label, u."isPublished", u."occupancyStatus", p.name as "propertyName"
    FROM "Unit" u
    JOIN "Property" p ON u."propertyId" = p.id
    WHERE u."occupancyStatus" = 'VACANT'
  `);

  if (vacantUnits.length === 0) {
    console.log("No vacant units found.");
    return;
  }

  console.log(`Found ${vacantUnits.length} vacant unit(s):\n`);
  for (const u of vacantUnits) {
    console.log(`  ${u.propertyName} — ${u.label} (published: ${u.isPublished})`);
  }

  // Publish all vacant units
  const result = await client.query(`
    UPDATE "Unit"
    SET "isPublished" = true
    WHERE "occupancyStatus" = 'VACANT' AND ("isPublished" = false OR "isPublished" IS NULL)
  `);

  console.log(`\n✅ Published ${result.rowCount} unit(s).`);

  // Show final state
  const { rows: updated } = await client.query(`
    SELECT u.id, u.label, u."isPublished", u."occupancyStatus", p.name as "propertyName"
    FROM "Unit" u
    JOIN "Property" p ON u."propertyId" = p.id
    WHERE u."occupancyStatus" = 'VACANT'
  `);

  console.log("\nFinal state:");
  for (const u of updated) {
    console.log(`  ${u.propertyName} — ${u.label} (published: ${u.isPublished})`);
  }
}

main()
  .catch((e) => { console.error("Failed:", e); process.exit(1); })
  .finally(() => client.end());
