/**
 * One-time seed script — imports all property data from Nadeem's spreadsheets
 * into the Makada Properties database, then removes test records.
 *
 * Run with:  npx tsx prisma/seed-import.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── helpers ────────────────────────────────────────────────────────────────

const MONTHS_2026 = [
  "2026-01","2026-02","2026-03","2026-04","2026-05","2026-06",
  "2026-07","2026-08","2026-09","2026-10","2026-11","2026-12",
];

/** Mark months as PAID up to (and including) `throughIndex` (0-based). */
function paidThrough(leaseId: string, throughIndex: number) {
  return MONTHS_2026.slice(0, throughIndex + 1).map((period) => ({
    leaseId,
    period,
    status: "PAID" as const,
  }));
}

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("🏗️  Starting data import…\n");

  // ════════════════════════════════════════════════════════════════════════
  // 1. PROPERTIES & UNITS — Rental Properties 2026 (single-unit houses)
  // ════════════════════════════════════════════════════════════════════════

  // --- Circle Court ---
  const circleProperty = await prisma.property.create({
    data: {
      name: "Circle Court",
      address: "762 Circle Court, South San Francisco, CA",
      notes: "Connie moved in Feb 2021 for $3000/mo and $3000 security deposit.",
    },
  });
  const circleUnit = await prisma.unit.create({
    data: {
      propertyId: circleProperty.id,
      label: "Main Unit",
      bedrooms: 0, // not specified in sheet
      bathrooms: 0,
      rentAmount: 3000,
      depositAmount: 3000,
      occupancyStatus: "OCCUPIED",
    },
  });
  const circleTenant = await prisma.tenant.create({
    data: { fullName: "Maria Gonzalez" },
  });
  const circleLease = await prisma.lease.create({
    data: {
      unitId: circleUnit.id,
      tenantId: circleTenant.id,
      startDate: new Date("2021-02-01"),
      endDate: new Date("2027-01-31"),
      monthlyRent: 3000,
      status: "ACTIVE",
    },
  });
  // Paid Jan–Apr 2026
  for (const ps of paidThrough(circleLease.id, 3)) {
    await prisma.paymentStatus.create({ data: ps });
  }

  console.log("  ✓ Circle Court");

  // --- Railroad Avenue ---
  const railroadProperty = await prisma.property.create({
    data: {
      name: "Railroad Avenue",
      address: "342 Railroad Avenue, South San Francisco, CA 94080",
    },
  });
  const railroadUnit = await prisma.unit.create({
    data: {
      propertyId: railroadProperty.id,
      label: "Main Unit",
      bedrooms: 0,
      bathrooms: 0,
      rentAmount: 3200,
      depositAmount: 0,
      occupancyStatus: "OCCUPIED",
    },
  });
  const railroadTenant = await prisma.tenant.create({
    data: {
      fullName: "Jaime and Griselda Lopez",
      notes: "Contact: Eva",
    },
  });
  const railroadLease = await prisma.lease.create({
    data: {
      unitId: railroadUnit.id,
      tenantId: railroadTenant.id,
      startDate: new Date("2025-01-01"),
      endDate: new Date("2027-01-31"),
      monthlyRent: 3200,
      status: "ACTIVE",
    },
  });
  // Paid Jan–Mar 2026
  for (const ps of paidThrough(railroadLease.id, 2)) {
    await prisma.paymentStatus.create({ data: ps });
  }

  console.log("  ✓ Railroad Avenue");

  // --- Humbolt Street ---
  const humboltProperty = await prisma.property.create({
    data: {
      name: "Humbolt Street",
      address: "228 North Humbolt Street, San Mateo, CA 94401",
    },
  });
  const humboltUnit = await prisma.unit.create({
    data: {
      propertyId: humboltProperty.id,
      label: "Main Unit",
      bedrooms: 0,
      bathrooms: 0,
      rentAmount: 3000,
      depositAmount: 0,
      occupancyStatus: "OCCUPIED",
      notes: "Black sink. $250 misc in May.",
    },
  });
  const humboltTenant = await prisma.tenant.create({
    data: { fullName: "Jose Canal" },
  });
  const humboltLease = await prisma.lease.create({
    data: {
      unitId: humboltUnit.id,
      tenantId: humboltTenant.id,
      startDate: new Date("2025-01-01"),
      endDate: new Date("2027-01-31"),
      monthlyRent: 3000,
      status: "ACTIVE",
    },
  });
  // Paid Jan only 2026
  for (const ps of paidThrough(humboltLease.id, 0)) {
    await prisma.paymentStatus.create({ data: ps });
  }

  console.log("  ✓ Humbolt Street");

  // --- Montgomery Avenue ---
  const montgomeryProperty = await prisma.property.create({
    data: {
      name: "Montgomery Avenue",
      address: "1052 Montgomery Avenue, San Bruno, CA 94066",
      notes: "Bought property on 12/21/2017.",
    },
  });
  const montgomeryUnit = await prisma.unit.create({
    data: {
      propertyId: montgomeryProperty.id,
      label: "Main Unit",
      bedrooms: 0,
      bathrooms: 0,
      rentAmount: 3500,
      depositAmount: 0,
      occupancyStatus: "OCCUPIED",
    },
  });
  const montgomeryTenant = await prisma.tenant.create({
    data: { fullName: "Fausto" },
  });
  const montgomeryLease = await prisma.lease.create({
    data: {
      unitId: montgomeryUnit.id,
      tenantId: montgomeryTenant.id,
      startDate: new Date("2018-01-01"),
      endDate: new Date("2027-01-31"),
      monthlyRent: 3500,
      status: "ACTIVE",
    },
  });
  // Paid Jan–Feb 2026
  for (const ps of paidThrough(montgomeryLease.id, 1)) {
    await prisma.paymentStatus.create({ data: ps });
  }

  console.log("  ✓ Montgomery Avenue");

  // --- Lakeview Way ---
  const lakeviewProperty = await prisma.property.create({
    data: {
      name: "Lakeview Way",
      address: "303 Lakeview Way, Emerald Hills, CA 94062",
    },
  });
  const lakeviewUnit = await prisma.unit.create({
    data: {
      propertyId: lakeviewProperty.id,
      label: "Main Unit",
      bedrooms: 0,
      bathrooms: 0,
      rentAmount: 10000,
      depositAmount: 10000,
      occupancyStatus: "OCCUPIED",
    },
  });
  const lakeviewTenant = await prisma.tenant.create({
    data: {
      fullName: "Betsy Carroll",
      notes: "Security deposit of $10,000. Moved in 12/01/2025.",
    },
  });
  const lakeviewLease = await prisma.lease.create({
    data: {
      unitId: lakeviewUnit.id,
      tenantId: lakeviewTenant.id,
      startDate: new Date("2025-12-01"),
      endDate: new Date("2027-11-30"),
      monthlyRent: 10000,
      status: "ACTIVE",
    },
  });
  // No rent received columns in sheet for 2026 — skip payment statuses

  console.log("  ✓ Lakeview Way");

  // ════════════════════════════════════════════════════════════════════════
  // 2. 500 NORTH SAN MATEO DR — 13 units
  // ════════════════════════════════════════════════════════════════════════

  const sanMateoProperty = await prisma.property.create({
    data: {
      name: "500 N San Mateo",
      address: "500 North San Mateo Dr., San Mateo, CA 94401",
      notes: "Property closed on 1/16/2026. Copper wiring. Laundry has 2 dryers and 1 washer.",
    },
  });

  const smUnits: { label: string; bed: number; bath: number; occ: "OCCUPIED" | "VACANT"; notes: string }[] = [
    { label: "Unit 101", bed: 1, bath: 1, occ: "OCCUPIED", notes: "Downstairs 1st building 1st left. Gut job — need to get out." },
    { label: "Unit 102", bed: 1, bath: 1, occ: "OCCUPIED", notes: "Downstairs 1st building back unit left. Has carpet, slider not working, floor looks good, kitchen/bath notes." },
    { label: "Unit 103", bed: 1, bath: 1, occ: "OCCUPIED", notes: "Downstairs 1st building 1st unit on right. Dated kitchen, vinyl floor, exhaust fan doesn't work, kitchen needs work. Balcony in good shape." },
    { label: "Unit 104", bed: 1, bath: 1, occ: "OCCUPIED", notes: "1st building back unit downstairs on right. All remodeled. Only unit with dishwasher. New windows and slider. Current on-site manager." },
    { label: "Unit 105", bed: 1, bath: 1, occ: "OCCUPIED", notes: "Downstairs 2nd building front right. Floor not carpet, kitchen counter looks good, heater works." },
    { label: "Unit 201", bed: 1, bath: 1, occ: "OCCUPIED", notes: "Upstairs back unit on right. Gut job, using plywood as wall, opening to room. Tenant has been there 15 years. Needs to get out." },
    { label: "Unit 202", bed: 1, bath: 1, occ: "OCCUPIED", notes: "Upstairs building 1 front right. Gut job, exhaust works." },
    { label: "Unit 203", bed: 1, bath: 1, occ: "OCCUPIED", notes: "Upstairs building 1 back left unit. Old carpet, gut job, exhaust unhooked, tenant there since 1990s." },
    { label: "Unit 204", bed: 1, bath: 1, occ: "OCCUPIED", notes: "Upstairs building 1 front unit on left. Hoarder, could not see. Has a garage that could not open." },
    { label: "Unit 205", bed: 1, bath: 1, occ: "VACANT", notes: "2nd building upstairs front unit on left. Floor not carpet, curtain in living room, good bathroom floor. 3 prong outlet, GFCI in kitchen." },
    { label: "Unit 206", bed: 1, bath: 1, occ: "OCCUPIED", notes: "2nd building upstairs back unit on left. Floor not carpet, granite counter, paint good, bathroom in good shape. Good tenants who keep it nice." },
    { label: "Unit 207", bed: 2, bath: 1, occ: "OCCUPIED", notes: "2nd building upstairs front right. Good carpet, kitchen new cabinets, electric stove, exhaust works. Tenant has been there 21 years. Do not raise rent." },
    { label: "Unit 208", bed: 1, bath: 1, occ: "OCCUPIED", notes: "2nd building upstairs unit on right back. Tile floor in entry and kitchen, rest is carpet, granite counter. 3 years of being tenant." },
  ];

  for (const u of smUnits) {
    await prisma.unit.create({
      data: {
        propertyId: sanMateoProperty.id,
        label: u.label,
        bedrooms: u.bed,
        bathrooms: u.bath,
        rentAmount: 0, // no rent amounts in sheet
        depositAmount: 0,
        occupancyStatus: u.occ,
        notes: u.notes,
      },
    });
  }

  console.log("  ✓ 500 N San Mateo (13 units)");

  // ════════════════════════════════════════════════════════════════════════
  // 3. 1110 HADDON DRIVE — 6 units with full tenant/lease/payment data
  // ════════════════════════════════════════════════════════════════════════

  const haddonProperty = await prisma.property.create({
    data: {
      name: "1110 Haddon Drive",
      address: "1110 Haddon Drive, San Mateo, CA",
      notes: "Property closed on 10/31/2024. Common expenses: PG&E, waste, lawn (Jose), water. Laundry money. $664 fire inspection April 2026.",
    },
  });

  // --- Unit 1 (1.5 bed) ---
  const hU1 = await prisma.unit.create({
    data: {
      propertyId: haddonProperty.id,
      label: "Unit 1",
      bedrooms: 1,
      bathrooms: 1,
      rentAmount: 2610,
      depositAmount: 2695,
      occupancyStatus: "OCCUPIED",
      notes: "1.5 bd. Right garage. Lease signed 03/01/2019.",
    },
  });
  const hT1 = await prisma.tenant.create({
    data: {
      fullName: "Jose Pena",
      email: "jospena85@gmail.com",
      notes: "Also: Stephanie Ravello (sthephani8705@hotmail.com).",
    },
  });
  const hL1 = await prisma.lease.create({
    data: {
      unitId: hU1.id,
      tenantId: hT1.id,
      startDate: new Date("2019-03-01"),
      endDate: new Date("2027-02-28"),
      monthlyRent: 2610,
      status: "ACTIVE",
    },
  });
  for (const ps of paidThrough(hL1.id, 3)) {
    await prisma.paymentStatus.create({ data: ps });
  }

  console.log("  ✓ Haddon Unit 1");

  // --- Unit 2 (1.5 bed) ---
  const hU2 = await prisma.unit.create({
    data: {
      propertyId: haddonProperty.id,
      label: "Unit 2",
      bedrooms: 1,
      bathrooms: 1,
      rentAmount: 2660,
      depositAmount: 2795,
      occupancyStatus: "OCCUPIED",
      notes: "1.5 bd. Rent is $2600 plus $60 for garage. Previous tenant Beverly Ceron (etelcea@yahoo.com) moved out 11/28/2024.",
    },
  });
  const hT2 = await prisma.tenant.create({
    data: {
      fullName: "Sabad Menera Correa",
      phone: "6505043384",
      notes: "Also: Nereyda Nunez Martinez (6504250593), Edgardo Menera Nunez (6504838168), Stephanie Mejia Vela (6504314453). Moved in 12/15/2024.",
    },
  });
  const hL2 = await prisma.lease.create({
    data: {
      unitId: hU2.id,
      tenantId: hT2.id,
      startDate: new Date("2024-12-15"),
      endDate: new Date("2026-12-14"),
      monthlyRent: 2660,
      status: "ACTIVE",
    },
  });
  for (const ps of paidThrough(hL2.id, 3)) {
    await prisma.paymentStatus.create({ data: ps });
  }

  console.log("  ✓ Haddon Unit 2");

  // --- Unit 3 (2 bed) ---
  const hU3 = await prisma.unit.create({
    data: {
      propertyId: haddonProperty.id,
      label: "Unit 3",
      bedrooms: 2,
      bathrooms: 1,
      rentAmount: 2560,
      depositAmount: 1000,
      occupancyStatus: "OCCUPIED",
      notes: "Middle garage. Lease signed Aug 1, 2025 to $2560.",
    },
  });
  const hT3 = await prisma.tenant.create({
    data: {
      fullName: "Tom Fessler",
      email: "fesslerthomas@sbcglobal.net",
    },
  });
  const hL3 = await prisma.lease.create({
    data: {
      unitId: hU3.id,
      tenantId: hT3.id,
      startDate: new Date("2025-08-01"),
      endDate: new Date("2026-07-31"),
      monthlyRent: 2560,
      status: "ACTIVE",
    },
  });
  for (const ps of paidThrough(hL3.id, 3)) {
    await prisma.paymentStatus.create({ data: ps });
  }

  console.log("  ✓ Haddon Unit 3");

  // --- Unit 4 (1 bed) ---
  const hU4 = await prisma.unit.create({
    data: {
      propertyId: haddonProperty.id,
      label: "Unit 4",
      bedrooms: 1,
      bathrooms: 1,
      rentAmount: 2355,
      depositAmount: 2295,
      occupancyStatus: "OCCUPIED",
      notes: "Left garage. Lease signed June 2025. Stove repair $230 in Jan 2026.",
    },
  });
  const hT4 = await prisma.tenant.create({
    data: {
      fullName: "Michelle Blackwell",
      email: "blackwell.m.michelle@gmail.com",
      notes: "Also: Marco Varni (marcojvarni@gmail.com).",
    },
  });
  const hL4 = await prisma.lease.create({
    data: {
      unitId: hU4.id,
      tenantId: hT4.id,
      startDate: new Date("2025-06-01"),
      endDate: new Date("2026-05-31"),
      monthlyRent: 2355,
      status: "ACTIVE",
    },
  });
  for (const ps of paidThrough(hL4.id, 3)) {
    await prisma.paymentStatus.create({ data: ps });
  }

  console.log("  ✓ Haddon Unit 4");

  // --- Unit 5 (1 bed) ---
  const hU5 = await prisma.unit.create({
    data: {
      propertyId: haddonProperty.id,
      label: "Unit 5",
      bedrooms: 1,
      bathrooms: 1,
      rentAmount: 2305,
      depositAmount: 2495,
      occupancyStatus: "OCCUPIED",
      notes: "Carport left. Plus $55/mo pet charge. Lease signed June 2024.",
    },
  });
  const hT5 = await prisma.tenant.create({
    data: {
      fullName: "Jaime Demelo",
      email: "jamie.demelo24@gmail.com",
      notes: "Also: Jose Leon Gonzalez (Joseelg9@gmail.com). $55/mo pet charge.",
    },
  });
  const hL5 = await prisma.lease.create({
    data: {
      unitId: hU5.id,
      tenantId: hT5.id,
      startDate: new Date("2024-06-01"),
      endDate: new Date("2026-05-31"),
      monthlyRent: 2305,
      status: "ACTIVE",
      notes: "Plus $55/mo pet charge.",
    },
  });
  for (const ps of paidThrough(hL5.id, 3)) {
    await prisma.paymentStatus.create({ data: ps });
  }

  console.log("  ✓ Haddon Unit 5");

  // --- Unit 6 (2 bed) ---
  const hU6 = await prisma.unit.create({
    data: {
      propertyId: haddonProperty.id,
      label: "Unit 6",
      bedrooms: 2,
      bathrooms: 1,
      rentAmount: 2510,
      depositAmount: 2350,
      occupancyStatus: "OCCUPIED",
      notes: "Carport middle. The right parking stall against the back fence is also assigned. Tenant knows to move car early Tues/Thurs for street cleaning. Lease originally signed 07/01/2020, renewed to $2510 on 07/01/2025.",
    },
  });
  const hT6 = await prisma.tenant.create({
    data: {
      fullName: "Gilberto Reyes",
      email: "gr72814@gmail.com",
      notes: "Also: Aneli Menera (anelimenera@gmail.com), Ferdericko Tarfan.",
    },
  });
  const hL6 = await prisma.lease.create({
    data: {
      unitId: hU6.id,
      tenantId: hT6.id,
      startDate: new Date("2025-07-01"),
      endDate: new Date("2026-06-30"),
      monthlyRent: 2510,
      status: "ACTIVE",
    },
  });
  for (const ps of paidThrough(hL6.id, 3)) {
    await prisma.paymentStatus.create({ data: ps });
  }

  console.log("  ✓ Haddon Unit 6");

  // ════════════════════════════════════════════════════════════════════════
  // 4. CLEAN UP TEST DATA
  // ════════════════════════════════════════════════════════════════════════

  console.log("\n🧹 Cleaning up test data…");

  // Delete test tenants (and their leases/tickets cascade)
  const testNames = ["Laura Zamora", "Zain Makada"];
  for (const name of testNames) {
    const tenant = await prisma.tenant.findFirst({
      where: { fullName: { equals: name, mode: "insensitive" } },
    });
    if (tenant) {
      // Delete leases first (payment statuses cascade)
      await prisma.lease.deleteMany({ where: { tenantId: tenant.id } });
      // Delete maintenance tickets
      await prisma.maintenanceTicket.deleteMany({ where: { tenantId: tenant.id } });
      // Delete the tenant
      await prisma.tenant.delete({ where: { id: tenant.id } });
      console.log(`  ✓ Removed test tenant: ${name}`);

      // Also clean up their Supabase auth account if they had one
      // (This would need the admin client — skip for now, can do manually)
    } else {
      console.log(`  – Test tenant "${name}" not found, skipping`);
    }
  }

  // Delete any properties that were test data (if any units have no real data)
  // Check for a "Test Property" or similar
  const testProperties = await prisma.property.findMany({
    where: {
      OR: [
        { name: { contains: "test", mode: "insensitive" } },
        { name: { contains: "sample", mode: "insensitive" } },
      ],
    },
  });
  for (const p of testProperties) {
    await prisma.property.delete({ where: { id: p.id } });
    console.log(`  ✓ Removed test property: ${p.name}`);
  }

  // ════════════════════════════════════════════════════════════════════════

  const propertyCount = await prisma.property.count();
  const unitCount = await prisma.unit.count();
  const tenantCount = await prisma.tenant.count();
  const leaseCount = await prisma.lease.count();
  const paymentCount = await prisma.paymentStatus.count();

  console.log(`\n✅ Import complete!`);
  console.log(`   ${propertyCount} properties, ${unitCount} units, ${tenantCount} tenants, ${leaseCount} leases, ${paymentCount} payment records`);
}

main()
  .catch((e) => {
    console.error("❌ Import failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
