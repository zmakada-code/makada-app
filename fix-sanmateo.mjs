/**
 * Comprehensive 500 N San Mateo rebuild with FULL data from:
 * - AppFolio Properties (April 2026 — current status)
 * - Owner Packet Rent Roll (Feb 2026 — tenant names, deposits, lease dates)
 * - Owner Packet Transactions (Feb 2026 — payment history)
 * - Owner Packet Delinquency report
 * - Work Order 4750-1 (Unit 205 stove)
 *
 * Also: deduplicates, removes test data, fixes Haddon address.
 * Run: node fix-sanmateo.mjs
 */

import pg from "pg";
const { Client } = pg;

const DATABASE_URL =
  "postgresql://postgres.qitktpzegtpjkpjdkjka:TRjCT4IryUbyacZl@aws-1-us-east-2.pooler.supabase.com:5432/postgres";

const client = new Client({ connectionString: DATABASE_URL });

function cuid() {
  return "c" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function deleteUnitCascade(unitId) {
  const leases = await client.query(`SELECT id FROM "Lease" WHERE "unitId" = $1`, [unitId]);
  for (const l of leases.rows) {
    await client.query(`DELETE FROM "PaymentStatus" WHERE "leaseId" = $1`, [l.id]);
  }
  await client.query(`DELETE FROM "Lease" WHERE "unitId" = $1`, [unitId]);
  await client.query(`DELETE FROM "MaintenanceTicket" WHERE "unitId" = $1`, [unitId]);
  await client.query(`DELETE FROM "Inquiry" WHERE "unitId" = $1`, [unitId]);
  await client.query(`DELETE FROM "Unit" WHERE id = $1`, [unitId]);
}

async function main() {
  await client.connect();
  console.log("🔧 Connected.\n");

  // ══════════════════════════════════════════════════════════════
  // STEP 1: Deduplicate
  // ══════════════════════════════════════════════════════════════
  console.log("── Deduplicating ──");
  const dupProps = await client.query(`
    SELECT name, array_agg(id ORDER BY "createdAt" ASC) as ids
    FROM "Property" GROUP BY name HAVING COUNT(*) > 1
  `);
  for (const row of dupProps.rows) {
    for (const pid of row.ids.slice(1)) {
      const units = await client.query(`SELECT id FROM "Unit" WHERE "propertyId" = $1`, [pid]);
      for (const u of units.rows) await deleteUnitCascade(u.id);
      await client.query(`DELETE FROM "Property" WHERE id = $1`, [pid]);
    }
    console.log(`  ✓ Deduped property: ${row.name}`);
  }
  const dupT = await client.query(`
    SELECT "fullName", array_agg(id ORDER BY "createdAt" ASC) as ids
    FROM "Tenant" GROUP BY "fullName" HAVING COUNT(*) > 1
  `);
  for (const row of dupT.rows) {
    for (const tid of row.ids.slice(1)) {
      const leases = await client.query(`SELECT id FROM "Lease" WHERE "tenantId" = $1`, [tid]);
      for (const l of leases.rows) await client.query(`DELETE FROM "PaymentStatus" WHERE "leaseId" = $1`, [l.id]);
      await client.query(`DELETE FROM "Lease" WHERE "tenantId" = $1`, [tid]);
      await client.query(`DELETE FROM "MaintenanceTicket" WHERE "tenantId" = $1`, [tid]);
      await client.query(`DELETE FROM "Tenant" WHERE id = $1`, [tid]);
    }
    console.log(`  ✓ Deduped tenant: ${row.fullName}`);
  }
  // Orphaned leases
  const orph = await client.query(`SELECT l.id FROM "Lease" l LEFT JOIN "Tenant" t ON l."tenantId" = t.id WHERE t.id IS NULL`);
  for (const l of orph.rows) {
    await client.query(`DELETE FROM "PaymentStatus" WHERE "leaseId" = $1`, [l.id]);
    await client.query(`DELETE FROM "Lease" WHERE id = $1`, [l.id]);
  }
  // Test tenants
  for (const name of ["Laura Zamora", "Zain Makada"]) {
    const res = await client.query(`SELECT id FROM "Tenant" WHERE LOWER("fullName") = LOWER($1)`, [name]);
    for (const t of res.rows) {
      const leases = await client.query(`SELECT id FROM "Lease" WHERE "tenantId" = $1`, [t.id]);
      for (const l of leases.rows) await client.query(`DELETE FROM "PaymentStatus" WHERE "leaseId" = $1`, [l.id]);
      await client.query(`DELETE FROM "Lease" WHERE "tenantId" = $1`, [t.id]);
      await client.query(`DELETE FROM "MaintenanceTicket" WHERE "tenantId" = $1`, [t.id]);
      await client.query(`DELETE FROM "Tenant" WHERE id = $1`, [t.id]);
      console.log(`  ✓ Removed: ${name}`);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // STEP 2: Rebuild 500 N San Mateo
  // ══════════════════════════════════════════════════════════════
  console.log("\n── Rebuilding 500 N San Mateo ──");

  const smRes = await client.query(
    `SELECT id FROM "Property" WHERE name LIKE '%San Mateo%' OR name LIKE '%san mateo%' LIMIT 1`
  );
  let smId;
  if (smRes.rows.length > 0) {
    smId = smRes.rows[0].id;
    const existing = await client.query(`SELECT id, label FROM "Unit" WHERE "propertyId" = $1`, [smId]);
    for (const u of existing.rows) {
      await deleteUnitCascade(u.id);
    }
    console.log(`  Cleared ${existing.rows.length} old units`);
    await client.query(
      `UPDATE "Property" SET name = $1, address = $2, notes = $3, "updatedAt" = NOW() WHERE id = $4`,
      ["500 N San Mateo", "500 North San Mateo Dr., San Mateo, CA 94401-2365",
       "Property closed on 1/16/2026. Managed by Mid Peninsula Management, Inc. (650) 692-0573. Owner: Mehreen Makada, 215 Olive Hill Lane, Woodside CA 94062. Copper wiring. Laundry has 2 dryers and 1 washer (laundry income collected). Property built before 1978. Maintenance limit $500.",
       smId]
    );
  } else {
    smId = cuid();
    await client.query(
      `INSERT INTO "Property" (id, name, address, notes, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,NOW(),NOW())`,
      [smId, "500 N San Mateo", "500 North San Mateo Dr., San Mateo, CA 94401-2365",
       "Property closed on 1/16/2026. Managed by Mid Peninsula Management, Inc. (650) 692-0573. Owner: Mehreen Makada, 215 Olive Hill Lane, Woodside CA 94062. Copper wiring. Laundry has 2 dryers and 1 washer. Property built before 1978. Maintenance limit $500."]
    );
  }

  // ── All 13 units with REAL data from rent roll + AppFolio ──
  const units = [
    {
      label: "Unit 101", bed: 1, bath: 1, rent: 2250, deposit: 1595,
      occ: "VACANT",
      notes: "Downstairs 1st building 1st left. Gut job — need to get out. Previously occupied by Caminar, Inc (eviction). Roxanne Richards paid rent. Move-in 07/09/2013.",
      tenant: null, // Vacant as of April 2026
    },
    {
      label: "Unit 102", bed: 1, bath: 1, rent: 2550, deposit: 4000,
      occ: "OCCUPIED",
      notes: "Downstairs 1st building back unit left. Has carpet, slider not working, floor looks good.",
      tenant: { name: "Everardo Lozano", moveIn: "2020-02-01", leaseFrom: "2020-02-06", leaseTo: "2020-08-21",
                notes: "Month-to-month since 08/21/2020. Deposit $4,000. Pays by eCheck." },
    },
    {
      label: "Unit 103", bed: 1, bath: 1, rent: 2175, deposit: 0,
      occ: "OCCUPIED",
      notes: "Downstairs 1st building 1st unit on right. Dated kitchen, vinyl floor, exhaust fan doesn't work. Balcony in good shape.",
      tenant: { name: "Miguel Angel Cruz Herrera", moveIn: "2019-03-01", leaseFrom: "2019-02-21", leaseTo: "2019-03-31",
                notes: "Month-to-month since 03/31/2019. 12/10/2025: emailed John Ohlund to pay difference with new amount — either send $500 this month or next month. 09/25/2025: 3-day notice served." },
    },
    {
      label: "Unit 104", bed: 1, bath: 1, rent: 2200, deposit: 0,
      occ: "OCCUPIED",
      notes: "1st building back unit downstairs on right. All remodeled. Only unit with dishwasher. New windows and slider. Current on-site manager.",
      tenant: { name: "Taunuuga S. Kome", moveIn: "2024-09-01", leaseFrom: "2024-09-01", leaseTo: "2027-03-14",
                notes: "Active lease through 03/14/2027. Rent was $1,775 in Feb 2026, increased to $2,200 by April 2026. Gracerela Flores also pays partial rent and $200/mo garage rent for this unit." },
    },
    {
      label: "Unit 105", bed: 1, bath: 1, rent: 2266.69, deposit: 2250,
      occ: "OCCUPIED",
      notes: "Downstairs 2nd building front right. Floor not carpet, kitchen counter looks good, heater works. Section 8 / HUD rent.",
      tenant: { name: "Philip C. Harter", moveIn: "2024-07-19", leaseFrom: "2024-07-19", leaseTo: "2025-07-18",
                phone: null, email: null,
                notes: "Month-to-month since 07/18/2025. Section 8 / HUD rent. 11/03/2025: Caminar called — tenant hospitalized, unknown when discharged. Social worker: ElaineOngolea at 650-526-1801. Pays cash. Deposit $2,250." },
    },
    {
      label: "Unit 201", bed: 1, bath: 1, rent: 1800, deposit: 1095,
      occ: "OCCUPIED",
      notes: "Upstairs back unit on right. Gut job, using plywood as wall. Tenant has been there 15 years. Needs to get out.",
      tenant: { name: "Simeon H. Lohrentz", moveIn: "2010-10-20", leaseFrom: "2012-12-06", leaseTo: "2012-12-07",
                notes: "Month-to-month since 12/07/2012. Tenant since 2010. Making payments. 07/26/2023, 06/13/2023: making payments. 10/06/2022: emailed friendly rent reminder. Deposit $1,095." },
    },
    {
      label: "Unit 202", bed: 1, bath: 1, rent: 2070, deposit: 373,
      occ: "OCCUPIED",
      notes: "Upstairs building 1 front right. Alexander Sanchez moved in April 2026, replacing Ivor J. Payne.",
      tenant: { name: "Alexander Sanchez", moveIn: "2026-04-09", leaseFrom: "2026-04-09", leaseTo: "2027-03-31",
                notes: "Active lease through 03/31/2027. Security deposit $373. Took over from Ivor J. Payne. Previous tenant Ivor Payne had medical emergency (mother in dialysis), couldn't make rent. 3-day notice served 02/12/2026. Lease fee $500." },
    },
    {
      label: "Unit 203", bed: 1, bath: 1, rent: 2015, deposit: 650,
      occ: "OCCUPIED",
      notes: "Upstairs building 1 back left unit. Old carpet, gut job, exhaust unhooked, tenant there since 2007.",
      tenant: { name: "Lori Okada", moveIn: "2007-02-01", leaseFrom: "2011-10-25", leaseTo: "2011-10-26",
                notes: "Month-to-month since 10/26/2011. Tenant since 2007. Deposit $650. 10/27/2022: will send check in for past due and pay next month on 1st. Multiple call/msg attempts." },
    },
    {
      label: "Unit 204", bed: 1, bath: 1, rent: 2015, deposit: 950,
      occ: "OCCUPIED",
      notes: "Upstairs building 1 front unit on left. Hoarder, could not see. Has a garage that could not open.",
      tenant: { name: "Gracerela Flores", moveIn: "2007-02-01", leaseFrom: "2011-10-13", leaseTo: "2011-10-14",
                notes: "Month-to-month since 10/14/2011. Tenant since 2007. Deposit $950. Also pays $200/mo garage rent. Multiple payment references in Feb 2026 ($215 + $1,000 + $799.70 + $200 garage)." },
    },
    {
      label: "Unit 205", bed: 1, bath: 1, rent: 2150, deposit: 2150,
      occ: "VACANT",
      notes: "2nd building upstairs front unit on left. Floor not carpet, good bathroom floor. 3 prong outlet, GFCI in kitchen. Previously occupied by Wendy S. Medrano (650-797-7401, wendys2323650@gmail.com) & Julio C. Gomez (650-389-4272, sarahiw300@gmail.com). Lease ended 02/28/2026 (Notice-Unrented). Work Order #4750-1: stove replacement — tenant reported explosion on burners 12/21/2025, new stove delivered, total $765.09 ($47.50 labor + $717.59 materials). Garbage area cleared and hauled to dumps ($165 + $285 + $86 dump fees, April 2026).",
      tenant: null, // Vacant as of April 2026
    },
    {
      label: "Unit 206", bed: 1, bath: 1, rent: 2150, deposit: 2150,
      occ: "OCCUPIED",
      notes: "2nd building upstairs back unit on left. Floor not carpet, granite counter, paint good. Good tenants who keep it nice.",
      tenant: { name: "Luis C. Abon", moveIn: "2025-03-01", leaseFrom: "2025-03-01", leaseTo: "2026-02-28",
                notes: "Lease ended 02/28/2026, now month-to-month. Deposit $2,150." },
    },
    {
      label: "Unit 207", bed: 2, bath: 1, rent: 2975, deposit: 890,
      occ: "OCCUPIED",
      notes: "2nd building upstairs front right. Good carpet, new cabinets, electric stove, exhaust works. Tenant since 2007. Do not raise rent. Emergency call 04/14/2026: power outage, fridge light out, hood motor & light not working ($95).",
      tenant: { name: "Carla Flores-Abarca", moveIn: "2007-02-01", leaseFrom: "2019-11-01", leaseTo: "2019-11-02",
                notes: "Month-to-month since 11/02/2019. Tenant since 2007. Deposit $890. Pedro Abarca also pays rent. 06/05/2025: money order dropped off." },
    },
    {
      label: "Unit 208", bed: 1, bath: 1, rent: 2350, deposit: 3100,
      occ: "OCCUPIED",
      notes: "2nd building upstairs right back. Tile floor in entry/kitchen, rest carpet, granite counter.",
      tenant: { name: "Jesus Jimenez Napoles", moveIn: "2022-12-10", leaseFrom: "2022-12-10", leaseTo: "2023-11-30",
                notes: "Month-to-month since 11/30/2023. Deposit $3,100. Pays by CC receipt." },
    },
  ];

  for (const u of units) {
    const unitId = cuid();
    await client.query(
      `INSERT INTO "Unit" (id, "propertyId", label, bedrooms, bathrooms, "rentAmount", "depositAmount", "occupancyStatus", notes, "isPublished", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::"OccupancyStatus", $9, false, NOW(), NOW())`,
      [unitId, smId, u.label, u.bed, u.bath, u.rent, u.deposit, u.occ, u.notes]
    );

    if (u.tenant) {
      const tenantId = cuid();
      await client.query(
        `INSERT INTO "Tenant" (id, "fullName", email, phone, notes, "authLocked", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())`,
        [tenantId, u.tenant.name, u.tenant.email || null, u.tenant.phone || null, u.tenant.notes]
      );

      const leaseId = cuid();
      await client.query(
        `INSERT INTO "Lease" (id, "unitId", "tenantId", "startDate", "endDate", "monthlyRent", status, notes, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE'::"LeaseStatus", $7, NOW(), NOW())`,
        [leaseId, unitId, tenantId, u.tenant.leaseFrom, u.tenant.leaseTo, u.rent, u.tenant.notes]
      );

      // Mark Feb 2026 as PAID for occupied units (from Owner Packet transactions)
      const paidId = cuid();
      await client.query(
        `INSERT INTO "PaymentStatus" (id, "leaseId", period, status, "createdAt", "updatedAt")
         VALUES ($1, $2, '2026-02', 'PAID'::"PaymentState", NOW(), NOW())`,
        [paidId, leaseId]
      );
    }

    console.log(`  ✓ ${u.label} | ${u.occ} | $${u.rent} | ${u.tenant?.name || "—"}`);
  }

  // ══════════════════════════════════════════════════════════════
  // STEP 3: Fix Haddon address
  // ══════════════════════════════════════════════════════════════
  await client.query(
    `UPDATE "Property" SET address = $1, "updatedAt" = NOW() WHERE name LIKE '%Haddon%'`,
    ["1110 Haddon Drive, San Mateo, CA 94402"]
  );
  console.log("\n✓ Fixed Haddon Drive address (94402)");

  // ══════════════════════════════════════════════════════════════
  // FINAL REPORT
  // ══════════════════════════════════════════════════════════════
  console.log("\n═══════════════════════════════════");
  console.log("FINAL STATE:");
  console.log("═══════════════════════════════════\n");

  const props = await client.query(`SELECT id, name, address FROM "Property" ORDER BY name`);
  for (const p of props.rows) {
    const uc = await client.query(`SELECT COUNT(*) FROM "Unit" WHERE "propertyId" = $1`, [p.id]);
    console.log(`${p.name} (${uc.rows[0].count} units) — ${p.address}`);

    const unitList = await client.query(
      `SELECT u.label, u."occupancyStatus", u."rentAmount",
              t."fullName" as tenant_name
       FROM "Unit" u
       LEFT JOIN "Lease" l ON l."unitId" = u.id AND l.status = 'ACTIVE'
       LEFT JOIN "Tenant" t ON l."tenantId" = t.id
       WHERE u."propertyId" = $1
       ORDER BY u.label`, [p.id]
    );
    for (const u of unitList.rows) {
      const rent = parseFloat(u.rentAmount) > 0 ? `$${parseFloat(u.rentAmount).toLocaleString()}` : "—";
      console.log(`    ${u.label} | ${u.occupancyStatus} | ${rent} | ${u.tenant_name || "—"}`);
    }
    console.log("");
  }

  const counts = {};
  for (const table of ["Property", "Unit", "Tenant", "Lease", "PaymentStatus"]) {
    const r = await client.query(`SELECT COUNT(*) FROM "${table}"`);
    counts[table] = r.rows[0].count;
  }
  console.log(`Totals: ${counts.Property} properties, ${counts.Unit} units, ${counts.Tenant} tenants, ${counts.Lease} leases, ${counts.PaymentStatus} payment records`);
  console.log("\n✅ Done!");
}

main()
  .catch((e) => {
    console.error("❌ Failed:", e);
    process.exit(1);
  })
  .finally(() => client.end());
