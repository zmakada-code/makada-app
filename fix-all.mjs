/**
 * Comprehensive cleanup script:
 * 1. Removes all duplicate records (from running import twice)
 * 2. Removes test units from 500 N San Mateo that aren't in the real spreadsheet
 * 3. Verifies final state
 *
 * Run: node fix-all.mjs
 */

import pg from "pg";
const { Client } = pg;

const DATABASE_URL =
  "postgresql://postgres.qitktpzegtpjkpjdkjka:TRjCT4IryUbyacZl@aws-1-us-east-2.pooler.supabase.com:5432/postgres";

const client = new Client({ connectionString: DATABASE_URL });

// The 13 real unit labels from the spreadsheet
const REAL_SM_UNITS = [
  "Unit 101", "Unit 102", "Unit 103", "Unit 104", "Unit 105",
  "Unit 201", "Unit 202", "Unit 203", "Unit 204", "Unit 205",
  "Unit 206", "Unit 207", "Unit 208",
];

async function main() {
  await client.connect();
  console.log("🔧 Connected. Running full cleanup…\n");

  // ══════════════════════════════════════════════════════════════
  // STEP 1: Remove duplicate properties (keep oldest of each name)
  // ══════════════════════════════════════════════════════════════
  console.log("── Step 1: Removing duplicate properties ──");

  const dupProps = await client.query(`
    SELECT name, array_agg(id ORDER BY "createdAt" ASC) as ids
    FROM "Property"
    GROUP BY name
    HAVING COUNT(*) > 1
  `);

  for (const row of dupProps.rows) {
    const remove = row.ids.slice(1);
    for (const pid of remove) {
      const units = await client.query(`SELECT id FROM "Unit" WHERE "propertyId" = $1`, [pid]);
      for (const u of units.rows) {
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
    if (remove.length > 0) console.log(`  ✓ Removed ${remove.length} duplicate(s) of: ${row.name}`);
  }

  // ══════════════════════════════════════════════════════════════
  // STEP 2: Remove duplicate tenants (keep oldest of each name)
  // ══════════════════════════════════════════════════════════════
  console.log("\n── Step 2: Removing duplicate tenants ──");

  const dupTenants = await client.query(`
    SELECT "fullName", array_agg(id ORDER BY "createdAt" ASC) as ids
    FROM "Tenant"
    GROUP BY "fullName"
    HAVING COUNT(*) > 1
  `);

  for (const row of dupTenants.rows) {
    const remove = row.ids.slice(1);
    for (const tid of remove) {
      const leases = await client.query(`SELECT id FROM "Lease" WHERE "tenantId" = $1`, [tid]);
      for (const l of leases.rows) {
        await client.query(`DELETE FROM "PaymentStatus" WHERE "leaseId" = $1`, [l.id]);
      }
      await client.query(`DELETE FROM "Lease" WHERE "tenantId" = $1`, [tid]);
      await client.query(`DELETE FROM "MaintenanceTicket" WHERE "tenantId" = $1`, [tid]);
      await client.query(`DELETE FROM "Tenant" WHERE id = $1`, [tid]);
    }
    if (remove.length > 0) console.log(`  ✓ Removed ${remove.length} duplicate(s) of: ${row.fullName}`);
  }

  // ══════════════════════════════════════════════════════════════
  // STEP 3: Remove orphaned leases (tenant was deleted)
  // ══════════════════════════════════════════════════════════════
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
    console.log(`\n  ✓ Removed ${orphanedLeases.rows.length} orphaned lease(s)`);
  }

  // ══════════════════════════════════════════════════════════════
  // STEP 4: Remove test/extra units from 500 N San Mateo
  // Only keep the 13 real units from the spreadsheet
  // ══════════════════════════════════════════════════════════════
  console.log("\n── Step 3: Cleaning up 500 N San Mateo test units ──");

  const smProps = await client.query(`
    SELECT id FROM "Property" WHERE name LIKE '%San Mateo%' OR name LIKE '%san mateo%'
  `);

  for (const prop of smProps.rows) {
    // Get all units for this property
    const allUnits = await client.query(
      `SELECT id, label FROM "Unit" WHERE "propertyId" = $1`,
      [prop.id]
    );

    for (const unit of allUnits.rows) {
      // Check if this unit label matches one of the 13 real ones
      const isReal = REAL_SM_UNITS.some(
        (realLabel) => realLabel.toLowerCase() === unit.label.toLowerCase()
      );

      if (!isReal) {
        // Delete this test unit and everything attached to it
        const leases = await client.query(`SELECT id FROM "Lease" WHERE "unitId" = $1`, [unit.id]);
        for (const l of leases.rows) {
          await client.query(`DELETE FROM "PaymentStatus" WHERE "leaseId" = $1`, [l.id]);
        }
        await client.query(`DELETE FROM "Lease" WHERE "unitId" = $1`, [unit.id]);
        await client.query(`DELETE FROM "MaintenanceTicket" WHERE "unitId" = $1`, [unit.id]);
        await client.query(`DELETE FROM "Inquiry" WHERE "unitId" = $1`, [unit.id]);
        await client.query(`DELETE FROM "Unit" WHERE id = $1`, [unit.id]);
        console.log(`  ✓ Removed test unit: "${unit.label}"`);
      }
    }

    // Verify what's left
    const remaining = await client.query(
      `SELECT label, "occupancyStatus" FROM "Unit" WHERE "propertyId" = $1 ORDER BY label`,
      [prop.id]
    );
    console.log(`\n  500 N San Mateo now has ${remaining.rows.length} units:`);
    for (const u of remaining.rows) {
      console.log(`    ${u.label} — ${u.occupancyStatus}`);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // STEP 5: Also remove any leftover test tenants
  // ══════════════════════════════════════════════════════════════
  console.log("\n── Step 4: Removing any remaining test tenants ──");
  const testNames = ["Laura Zamora", "Zain Makada"];
  for (const name of testNames) {
    const res = await client.query(
      `SELECT id FROM "Tenant" WHERE LOWER("fullName") = LOWER($1)`,
      [name]
    );
    for (const t of res.rows) {
      const leases = await client.query(`SELECT id FROM "Lease" WHERE "tenantId" = $1`, [t.id]);
      for (const l of leases.rows) {
        await client.query(`DELETE FROM "PaymentStatus" WHERE "leaseId" = $1`, [l.id]);
      }
      await client.query(`DELETE FROM "Lease" WHERE "tenantId" = $1`, [t.id]);
      await client.query(`DELETE FROM "MaintenanceTicket" WHERE "tenantId" = $1`, [t.id]);
      await client.query(`DELETE FROM "Tenant" WHERE id = $1`, [t.id]);
      console.log(`  ✓ Removed: ${name}`);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // FINAL REPORT
  // ══════════════════════════════════════════════════════════════
  console.log("\n══════════════════════════════════════");
  console.log("FINAL DATABASE STATE:");
  console.log("══════════════════════════════════════");

  const props = await client.query(`SELECT id, name, address FROM "Property" ORDER BY name`);
  console.log(`\n${props.rows.length} Properties:`);
  for (const p of props.rows) {
    const unitCount = await client.query(`SELECT COUNT(*) FROM "Unit" WHERE "propertyId" = $1`, [p.id]);
    console.log(`  ${p.name} (${unitCount.rows[0].count} units) — ${p.address}`);
  }

  const tenants = await client.query(`
    SELECT t."fullName", t.email, u.label as unit, p.name as property
    FROM "Tenant" t
    LEFT JOIN "Lease" l ON l."tenantId" = t.id AND l.status = 'ACTIVE'
    LEFT JOIN "Unit" u ON l."unitId" = u.id
    LEFT JOIN "Property" p ON u."propertyId" = p.id
    ORDER BY t."fullName"
  `);
  console.log(`\n${tenants.rows.length} Tenants:`);
  for (const t of tenants.rows) {
    const loc = t.property ? `${t.property} · ${t.unit}` : "No active lease";
    console.log(`  ${t.fullName} ${t.email ? `(${t.email})` : ""} — ${loc}`);
  }

  const counts = {};
  for (const table of ["Property", "Unit", "Tenant", "Lease", "PaymentStatus"]) {
    const r = await client.query(`SELECT COUNT(*) FROM "${table}"`);
    counts[table] = r.rows[0].count;
  }
  console.log(`\nTotals: ${counts.Property} properties, ${counts.Unit} units, ${counts.Tenant} tenants, ${counts.Lease} leases, ${counts.PaymentStatus} payment records`);
  console.log("\n✅ All done!");
}

main()
  .catch((e) => {
    console.error("❌ Failed:", e);
    process.exit(1);
  })
  .finally(() => client.end());
