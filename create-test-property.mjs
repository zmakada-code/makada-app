/**
 * Creates a test property with one unit and Zain Makada as the tenant.
 * Also provisions a Supabase auth user so Zain can log into the tenant portal.
 *
 * Run: node create-test-property.mjs
 *
 * To clean up later: node delete-test-property.mjs
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

  // ── Create test property ──
  const propertyId = cuid();
  await client.query(
    `INSERT INTO "Property" (id, name, address, notes, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, NOW(), NOW())`,
    [propertyId, "Test Property", "123 Test Street, San Mateo, CA 94401", "TEST — delete after testing Stripe payments"]
  );
  console.log("✓ Created property: Test Property");

  // ── Create unit ──
  const unitId = cuid();
  await client.query(
    `INSERT INTO "Unit" (id, "propertyId", label, bedrooms, bathrooms, "rentAmount", "depositAmount", "occupancyStatus", notes, "isPublished", "publicDescription", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 2, 1, 1000.00, 1000.00, 'OCCUPIED', 'Test unit for Stripe payment testing', false, NULL, NOW(), NOW())`,
    [unitId, propertyId, "Unit 1"]
  );
  console.log("✓ Created unit: Unit 1 ($1,000/mo)");

  // ── Create tenant: Zain Makada ──
  const tenantId = cuid();
  await client.query(
    `INSERT INTO "Tenant" (id, "fullName", email, phone, notes, "portalPassword", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
    [tenantId, "Zain Makada", "attysfnm@gmail.com", null, "TEST tenant — delete after testing", "test1234"]
  );
  console.log("✓ Created tenant: Zain Makada (attysfnm@gmail.com)");

  // ── Create active lease ──
  const leaseId = cuid();
  const startDate = new Date("2026-04-01");
  const endDate = new Date("2027-03-31");
  await client.query(
    `INSERT INTO "Lease" (id, "unitId", "tenantId", "startDate", "endDate", "monthlyRent", status, notes, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 1000.00, 'ACTIVE', 'Test lease for Stripe payment testing', NOW(), NOW())`,
    [leaseId, unitId, tenantId, startDate, endDate]
  );
  console.log("✓ Created lease: $1,000/mo, Apr 2026 – Mar 2027");

  // ── Create April 2026 payment record (unpaid) ──
  const paymentId = cuid();
  await client.query(
    `INSERT INTO "PaymentStatus" (id, "leaseId", period, status, "createdAt", "updatedAt")
     VALUES ($1, $2, '2026-04', 'UNKNOWN'::"PaymentState", NOW(), NOW())`,
    [paymentId, leaseId]
  );
  console.log("✓ Created April 2026 payment record (UNKNOWN — ready to test)");

  console.log("\n✅ Test setup complete!");
  console.log("   Property: Test Property (123 Test Street)");
  console.log("   Unit: Unit 1 — $1,000/mo");
  console.log("   Tenant: Zain Makada — attysfnm@gmail.com");
  console.log("   Portal password: test1234");
  console.log("\n   Login at https://zmak-zmakada.replit.app/login");
  console.log("   Then go to Payments → Pay Now to test Stripe checkout");
}

main()
  .catch((e) => { console.error("❌ Failed:", e); process.exit(1); })
  .finally(() => client.end());
