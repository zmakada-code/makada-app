/**
 * One-time seed script — imports all property data from spreadsheets
 * into the Makada Properties database via direct SQL, then removes test records.
 *
 * Run: node seed-import.mjs
 */

import pg from "pg";
const { Client } = pg;

// Use the session pooler (port 5432) for direct queries
const DATABASE_URL =
  "postgresql://postgres.qitktpzegtpjkpjdkjka:TRjCT4IryUbyacZl@aws-1-us-east-2.pooler.supabase.com:5432/postgres";

const client = new Client({ connectionString: DATABASE_URL });

// ─── helpers ────────────────────────────────────────────────────

function cuid() {
  // simple cuid-like id
  return "c" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const MONTHS_2026 = [
  "2026-01","2026-02","2026-03","2026-04","2026-05","2026-06",
  "2026-07","2026-08","2026-09","2026-10","2026-11","2026-12",
];

async function createProperty(name, address, notes = null) {
  const id = cuid();
  await client.query(
    `INSERT INTO "Property" (id, name, address, notes, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, NOW(), NOW())`,
    [id, name, address, notes]
  );
  return id;
}

async function createUnit(propertyId, label, bedrooms, bathrooms, rent, deposit, occupancy, notes = null) {
  const id = cuid();
  await client.query(
    `INSERT INTO "Unit" (id, "propertyId", label, bedrooms, bathrooms, "rentAmount", "depositAmount", "occupancyStatus", notes, "isPublished", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::\"OccupancyStatus\", $9, false, NOW(), NOW())`,
    [id, propertyId, label, bedrooms, bathrooms, rent, deposit, occupancy, notes]
  );
  return id;
}

async function createTenant(fullName, email = null, phone = null, notes = null) {
  const id = cuid();
  await client.query(
    `INSERT INTO "Tenant" (id, "fullName", email, phone, notes, "authLocked", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())`,
    [id, fullName, email, phone, notes]
  );
  return id;
}

async function createLease(unitId, tenantId, startDate, endDate, monthlyRent, status = "ACTIVE", notes = null) {
  const id = cuid();
  await client.query(
    `INSERT INTO "Lease" (id, "unitId", "tenantId", "startDate", "endDate", "monthlyRent", status, notes, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7::\"LeaseStatus\", $8, NOW(), NOW())`,
    [id, unitId, tenantId, startDate, endDate, monthlyRent, status, notes]
  );
  return id;
}

async function markPaid(leaseId, throughIndex) {
  for (let i = 0; i <= throughIndex; i++) {
    const id = cuid();
    await client.query(
      `INSERT INTO "PaymentStatus" (id, "leaseId", period, status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'PAID'::"PaymentState", NOW(), NOW())`,
      [id, leaseId, MONTHS_2026[i]]
    );
  }
}

// ─── main ───────────────────────────────────────────────────────

async function main() {
  await client.connect();
  console.log("🏗️  Connected. Starting data import…\n");

  // ══════════════════════════════════════════════════════════════
  // 1. Single-unit houses from Rental Properties 2026
  // ══════════════════════════════════════════════════════════════

  // --- Circle Court ---
  const circleP = await createProperty("Circle Court", "762 Circle Court, South San Francisco, CA", "Connie moved in Feb 2021 for $3000/mo and $3000 security deposit.");
  const circleU = await createUnit(circleP, "Main Unit", 0, 0, 3000, 3000, "OCCUPIED");
  const circleT = await createTenant("Maria Gonzalez");
  const circleL = await createLease(circleU, circleT, "2021-02-01", "2027-01-31", 3000);
  await markPaid(circleL, 3); // Jan–Apr
  console.log("  ✓ Circle Court");

  // --- Railroad Avenue ---
  const railroadP = await createProperty("Railroad Avenue", "342 Railroad Avenue, South San Francisco, CA 94080");
  const railroadU = await createUnit(railroadP, "Main Unit", 0, 0, 3200, 0, "OCCUPIED");
  const railroadT = await createTenant("Jaime and Griselda Lopez", null, null, "Contact: Eva");
  const railroadL = await createLease(railroadU, railroadT, "2025-01-01", "2027-01-31", 3200);
  await markPaid(railroadL, 2); // Jan–Mar
  console.log("  ✓ Railroad Avenue");

  // --- Humbolt Street ---
  const humboltP = await createProperty("Humbolt Street", "228 North Humbolt Street, San Mateo, CA 94401");
  const humboltU = await createUnit(humboltP, "Main Unit", 0, 0, 3000, 0, "OCCUPIED", "Black sink. $250 misc in May.");
  const humboltT = await createTenant("Jose Canal");
  const humboltL = await createLease(humboltU, humboltT, "2025-01-01", "2027-01-31", 3000);
  await markPaid(humboltL, 0); // Jan only
  console.log("  ✓ Humbolt Street");

  // --- Montgomery Avenue ---
  const montgomeryP = await createProperty("Montgomery Avenue", "1052 Montgomery Avenue, San Bruno, CA 94066", "Bought property on 12/21/2017.");
  const montgomeryU = await createUnit(montgomeryP, "Main Unit", 0, 0, 3500, 0, "OCCUPIED");
  const montgomeryT = await createTenant("Fausto");
  const montgomeryL = await createLease(montgomeryU, montgomeryT, "2018-01-01", "2027-01-31", 3500);
  await markPaid(montgomeryL, 1); // Jan–Feb
  console.log("  ✓ Montgomery Avenue");

  // --- Lakeview Way ---
  const lakeviewP = await createProperty("Lakeview Way", "303 Lakeview Way, Emerald Hills, CA 94062");
  const lakeviewU = await createUnit(lakeviewP, "Main Unit", 0, 0, 10000, 10000, "OCCUPIED");
  const lakeviewT = await createTenant("Betsy Carroll", null, null, "Security deposit of $10,000. Moved in 12/01/2025.");
  const lakeviewL = await createLease(lakeviewU, lakeviewT, "2025-12-01", "2027-11-30", 10000);
  // No payment data in sheet
  console.log("  ✓ Lakeview Way");

  // ══════════════════════════════════════════════════════════════
  // 2. 500 North San Mateo Dr — 13 units
  // ══════════════════════════════════════════════════════════════

  const smP = await createProperty("500 N San Mateo", "500 North San Mateo Dr., San Mateo, CA 94401", "Property closed on 1/16/2026. Copper wiring. Laundry has 2 dryers and 1 washer.");

  const smUnits = [
    ["Unit 101", 1, 1, "OCCUPIED", "Downstairs 1st building 1st left. Gut job — need to get out."],
    ["Unit 102", 1, 1, "OCCUPIED", "Downstairs 1st building back unit left. Has carpet, slider not working, floor looks good."],
    ["Unit 103", 1, 1, "OCCUPIED", "Downstairs 1st building 1st unit on right. Dated kitchen, vinyl floor, exhaust fan doesn't work. Balcony in good shape."],
    ["Unit 104", 1, 1, "OCCUPIED", "1st building back unit downstairs on right. All remodeled. Only unit with dishwasher. New windows and slider. Current on-site manager."],
    ["Unit 105", 1, 1, "OCCUPIED", "Downstairs 2nd building front right. Floor not carpet, kitchen counter looks good, heater works."],
    ["Unit 201", 1, 1, "OCCUPIED", "Upstairs back unit on right. Gut job, using plywood as wall. Tenant has been there 15 years. Needs to get out."],
    ["Unit 202", 1, 1, "OCCUPIED", "Upstairs building 1 front right. Gut job, exhaust works."],
    ["Unit 203", 1, 1, "OCCUPIED", "Upstairs building 1 back left unit. Old carpet, gut job, exhaust unhooked, tenant there since 1990s."],
    ["Unit 204", 1, 1, "OCCUPIED", "Upstairs building 1 front unit on left. Hoarder, could not see. Has a garage that could not open."],
    ["Unit 205", 1, 1, "VACANT", "2nd building upstairs front unit on left. Floor not carpet, good bathroom floor. 3 prong outlet, GFCI in kitchen."],
    ["Unit 206", 1, 1, "OCCUPIED", "2nd building upstairs back unit on left. Floor not carpet, granite counter, paint good. Good tenants who keep it nice."],
    ["Unit 207", 2, 1, "OCCUPIED", "2nd building upstairs front right. Good carpet, new cabinets, electric stove, exhaust works. Tenant 21 years. Do not raise rent."],
    ["Unit 208", 1, 1, "OCCUPIED", "2nd building upstairs right back. Tile floor in entry/kitchen, rest carpet, granite counter. 3 years tenant."],
  ];

  for (const [label, bed, bath, occ, notes] of smUnits) {
    await createUnit(smP, label, bed, bath, 0, 0, occ, notes);
  }
  console.log("  ✓ 500 N San Mateo (13 units)");

  // ══════════════════════════════════════════════════════════════
  // 3. 1110 Haddon Drive — 6 units with tenants/leases/payments
  // ══════════════════════════════════════════════════════════════

  const haddonP = await createProperty("1110 Haddon Drive", "1110 Haddon Drive, San Mateo, CA 94402", "Property closed 10/31/2024. Common: PG&E, waste, lawn (Jose), water. $664 fire inspection Apr 2026.");

  // Unit 1
  const hU1 = await createUnit(haddonP, "Unit 1", 1, 1, 2610, 2695, "OCCUPIED", "1.5 bd. Right garage. Lease signed 03/01/2019.");
  const hT1 = await createTenant("Jose Pena", "jospena85@gmail.com", null, "Also: Stephanie Ravello (sthephani8705@hotmail.com).");
  const hL1 = await createLease(hU1, hT1, "2019-03-01", "2027-02-28", 2610);
  await markPaid(hL1, 3);
  console.log("  ✓ Haddon Unit 1");

  // Unit 2
  const hU2 = await createUnit(haddonP, "Unit 2", 1, 1, 2660, 2795, "OCCUPIED", "1.5 bd. Rent $2600 + $60 garage. Previous: Beverly Ceron moved out 11/28/2024.");
  const hT2 = await createTenant("Sabad Menera Correa", null, "6505043384", "Also: Nereyda Nunez Martinez (6504250593), Edgardo Menera Nunez (6504838168), Stephanie Mejia Vela (6504314453). Moved in 12/15/2024.");
  const hL2 = await createLease(hU2, hT2, "2024-12-15", "2026-12-14", 2660);
  await markPaid(hL2, 3);
  console.log("  ✓ Haddon Unit 2");

  // Unit 3
  const hU3 = await createUnit(haddonP, "Unit 3", 2, 1, 2560, 1000, "OCCUPIED", "Middle garage. Lease signed Aug 2025.");
  const hT3 = await createTenant("Tom Fessler", "fesslerthomas@sbcglobal.net");
  const hL3 = await createLease(hU3, hT3, "2025-08-01", "2026-07-31", 2560);
  await markPaid(hL3, 3);
  console.log("  ✓ Haddon Unit 3");

  // Unit 4
  const hU4 = await createUnit(haddonP, "Unit 4", 1, 1, 2355, 2295, "OCCUPIED", "Left garage. Lease signed June 2025. Stove repair $230 Jan 2026.");
  const hT4 = await createTenant("Michelle Blackwell", "blackwell.m.michelle@gmail.com", null, "Also: Marco Varni (marcojvarni@gmail.com).");
  const hL4 = await createLease(hU4, hT4, "2025-06-01", "2026-05-31", 2355);
  await markPaid(hL4, 3);
  console.log("  ✓ Haddon Unit 4");

  // Unit 5
  const hU5 = await createUnit(haddonP, "Unit 5", 1, 1, 2305, 2495, "OCCUPIED", "Carport left. +$55/mo pet charge. Lease signed June 2024.");
  const hT5 = await createTenant("Jaime Demelo", "jamie.demelo24@gmail.com", null, "Also: Jose Leon Gonzalez (Joseelg9@gmail.com). $55/mo pet charge.");
  const hL5 = await createLease(hU5, hT5, "2024-06-01", "2026-05-31", 2305, "ACTIVE", "Plus $55/mo pet charge.");
  await markPaid(hL5, 3);
  console.log("  ✓ Haddon Unit 5");

  // Unit 6
  const hU6 = await createUnit(haddonP, "Unit 6", 2, 1, 2510, 2350, "OCCUPIED", "Carport middle. Right parking stall against back fence also assigned. Move car Tues/Thurs for street cleaning. Lease 07/01/2020, renewed to $2510 on 07/01/2025.");
  const hT6 = await createTenant("Gilberto Reyes", "gr72814@gmail.com", null, "Also: Aneli Menera (anelimenera@gmail.com), Ferdericko Tarfan.");
  const hL6 = await createLease(hU6, hT6, "2025-07-01", "2026-06-30", 2510);
  await markPaid(hL6, 3);
  console.log("  ✓ Haddon Unit 6");

  // ══════════════════════════════════════════════════════════════
  // 4. CLEAN UP TEST DATA
  // ══════════════════════════════════════════════════════════════

  console.log("\n🧹 Cleaning up test data…");

  const testNames = ["Laura Zamora", "Zain Makada"];
  for (const name of testNames) {
    const res = await client.query(
      `SELECT id FROM "Tenant" WHERE LOWER("fullName") = LOWER($1)`,
      [name]
    );
    if (res.rows.length > 0) {
      const tid = res.rows[0].id;
      // Get lease ids for cascade cleanup
      const leases = await client.query(`SELECT id FROM "Lease" WHERE "tenantId" = $1`, [tid]);
      for (const l of leases.rows) {
        await client.query(`DELETE FROM "PaymentStatus" WHERE "leaseId" = $1`, [l.id]);
      }
      await client.query(`DELETE FROM "Lease" WHERE "tenantId" = $1`, [tid]);
      await client.query(`DELETE FROM "MaintenanceTicket" WHERE "tenantId" = $1`, [tid]);
      await client.query(`DELETE FROM "Tenant" WHERE id = $1`, [tid]);
      console.log(`  ✓ Removed test tenant: ${name}`);
    } else {
      console.log(`  – "${name}" not found, skipping`);
    }
  }

  // Remove test properties
  const testProps = await client.query(
    `SELECT id, name FROM "Property" WHERE LOWER(name) LIKE '%test%' OR LOWER(name) LIKE '%sample%'`
  );
  for (const p of testProps.rows) {
    // cascade: units -> leases -> payment statuses, tickets
    const units = await client.query(`SELECT id FROM "Unit" WHERE "propertyId" = $1`, [p.id]);
    for (const u of units.rows) {
      const leases = await client.query(`SELECT id FROM "Lease" WHERE "unitId" = $1`, [u.id]);
      for (const l of leases.rows) {
        await client.query(`DELETE FROM "PaymentStatus" WHERE "leaseId" = $1`, [l.id]);
      }
      await client.query(`DELETE FROM "Lease" WHERE "unitId" = $1`, [u.id]);
      await client.query(`DELETE FROM "MaintenanceTicket" WHERE "unitId" = $1`, [u.id]);
    }
    await client.query(`DELETE FROM "Unit" WHERE "propertyId" = $1`, [p.id]);
    await client.query(`DELETE FROM "Property" WHERE id = $1`, [p.id]);
    console.log(`  ✓ Removed test property: ${p.name}`);
  }

  // Final counts
  const counts = {};
  for (const table of ["Property", "Unit", "Tenant", "Lease", "PaymentStatus"]) {
    const r = await client.query(`SELECT COUNT(*) FROM "${table}"`);
    counts[table] = r.rows[0].count;
  }

  console.log(`\n✅ Import complete!`);
  console.log(`   ${counts.Property} properties, ${counts.Unit} units, ${counts.Tenant} tenants, ${counts.Lease} leases, ${counts.PaymentStatus} payment records`);
}

main()
  .catch((e) => {
    console.error("❌ Import failed:", e);
    process.exit(1);
  })
  .finally(() => client.end());
