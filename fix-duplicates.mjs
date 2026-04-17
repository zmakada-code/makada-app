/**
 * Cleanup script — removes duplicate records created by running the import twice.
 * For each duplicate tenant/property, keeps the FIRST one created and deletes the rest.
 *
 * Run: node fix-duplicates.mjs
 */

import pg from "pg";
const { Client } = pg;

const DATABASE_URL =
  "postgresql://postgres.qitktpzegtpjkpjdkjka:TRjCT4IryUbyacZl@aws-1-us-east-2.pooler.supabase.com:5432/postgres";

const client = new Client({ connectionString: DATABASE_URL });

async function main() {
  await client.connect();
  console.log("🔧 Connected. Cleaning up duplicates…\n");

  // ── 1. Fix duplicate Tenants ──────────────────────────────────
  // Find tenants with the same fullName, keep the oldest (min id by createdAt)
  const dupTenants = await client.query(`
    SELECT "fullName", array_agg(id ORDER BY "createdAt" ASC) as ids
    FROM "Tenant"
    GROUP BY "fullName"
    HAVING COUNT(*) > 1
  `);

  for (const row of dupTenants.rows) {
    const keep = row.ids[0]; // keep the first one
    const remove = row.ids.slice(1); // delete the rest

    for (const tid of remove) {
      // Delete payment statuses for this tenant's leases
      const leases = await client.query(`SELECT id FROM "Lease" WHERE "tenantId" = $1`, [tid]);
      for (const l of leases.rows) {
        await client.query(`DELETE FROM "PaymentStatus" WHERE "leaseId" = $1`, [l.id]);
      }
      // Delete leases
      await client.query(`DELETE FROM "Lease" WHERE "tenantId" = $1`, [tid]);
      // Delete maintenance tickets
      await client.query(`DELETE FROM "MaintenanceTicket" WHERE "tenantId" = $1`, [tid]);
      // Delete the tenant
      await client.query(`DELETE FROM "Tenant" WHERE id = $1`, [tid]);
    }
    console.log(`  ✓ Removed ${remove.length} duplicate(s) of tenant: ${row.fullName}`);
  }

  // ── 2. Fix duplicate Properties ───────────────────────────────
  const dupProps = await client.query(`
    SELECT name, array_agg(id ORDER BY "createdAt" ASC) as ids
    FROM "Property"
    GROUP BY name
    HAVING COUNT(*) > 1
  `);

  for (const row of dupProps.rows) {
    const keep = row.ids[0];
    const remove = row.ids.slice(1);

    for (const pid of remove) {
      // Get units for this property
      const units = await client.query(`SELECT id FROM "Unit" WHERE "propertyId" = $1`, [pid]);
      for (const u of units.rows) {
        // Delete payment statuses for leases on this unit
        const leases = await client.query(`SELECT id FROM "Lease" WHERE "unitId" = $1`, [u.id]);
        for (const l of leases.rows) {
          await client.query(`DELETE FROM "PaymentStatus" WHERE "leaseId" = $1`, [l.id]);
        }
        await client.query(`DELETE FROM "Lease" WHERE "unitId" = $1`, [u.id]);
        await client.query(`DELETE FROM "MaintenanceTicket" WHERE "unitId" = $1`, [u.id]);
        await client.query(`DELETE FROM "Inquiry" WHERE "unitId" = $1`, [u.id]);
      }
      await client.query(`DELETE FROM "Unit" WHERE "propertyId" = $1`, [pid]);
      await client.query(`DELETE FROM "Property" WHERE id = $1`, [pid]);
    }
    console.log(`  ✓ Removed ${remove.length} duplicate(s) of property: ${row.name}`);
  }

  // ── 3. Fix any orphaned leases (tenant deleted but lease remains) ──
  const orphanedLeases = await client.query(`
    SELECT l.id FROM "Lease" l
    LEFT JOIN "Tenant" t ON l."tenantId" = t.id
    WHERE t.id IS NULL
  `);
  for (const l of orphanedLeases.rows) {
    await client.query(`DELETE FROM "PaymentStatus" WHERE "leaseId" = $1`, [l.id]);
    await client.query(`DELETE FROM "Lease" WHERE id = $1`, [l.id]);
  }
  if (orphanedLeases.rows.length > 0) {
    console.log(`  ✓ Removed ${orphanedLeases.rows.length} orphaned lease(s)`);
  }

  // ── Final counts ──────────────────────────────────────────────
  const counts = {};
  for (const table of ["Property", "Unit", "Tenant", "Lease", "PaymentStatus"]) {
    const r = await client.query(`SELECT COUNT(*) FROM "${table}"`);
    counts[table] = r.rows[0].count;
  }

  console.log(`\n✅ Cleanup complete!`);
  console.log(`   ${counts.Property} properties, ${counts.Unit} units, ${counts.Tenant} tenants, ${counts.Lease} leases, ${counts.PaymentStatus} payment records`);
}

main()
  .catch((e) => {
    console.error("❌ Cleanup failed:", e);
    process.exit(1);
  })
  .finally(() => client.end());
