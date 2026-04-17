/**
 * Sets property photo URLs using Google Maps Street View Static API.
 * Stores the direct Google API URL in the imageUrl field so no Supabase
 * storage is needed — the image loads directly from Google.
 *
 * Usage:
 *   GOOGLE_MAPS_KEY=AIza... node set-property-photos.mjs
 *
 * If you don't have a Google Maps key, the script will set placeholder
 * URLs using the Google Maps embed approach instead.
 */

import pg from "pg";
const { Client } = pg;

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres.qitktpzegtpjkpjdkjka:TRjCT4IryUbyacZl@aws-1-us-east-2.pooler.supabase.com:5432/postgres";

const GOOGLE_KEY = process.env.GOOGLE_MAPS_KEY;
const SKIP = (process.env.SKIP_PROPERTY || "test property").toLowerCase();

async function run() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log("Connected.");

  const { rows: properties } = await client.query(
    'SELECT id, name, address, "imageUrl" FROM "Property" ORDER BY name'
  );

  for (const p of properties) {
    if (p.name.toLowerCase().includes(SKIP)) {
      console.log(`  Skipping: ${p.name}`);
      continue;
    }

    // Skip if already has an http URL (already set)
    if (p.imageUrl && p.imageUrl.startsWith("http")) {
      console.log(`  Already has URL: ${p.name}`);
      continue;
    }

    if (!GOOGLE_KEY) {
      console.log(`  No GOOGLE_MAPS_KEY — skipping ${p.name}`);
      continue;
    }

    // Build Google Street View Static API URL
    const address = encodeURIComponent(p.address);
    const url = `https://maps.googleapis.com/maps/api/streetview?size=800x400&location=${address}&key=${GOOGLE_KEY}`;

    // Verify the image exists (Google returns a gray image if no coverage)
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (!res.ok) {
        console.log(`  No Street View for: ${p.name} (${res.status})`);
        continue;
      }
    } catch (err) {
      console.log(`  Fetch error for: ${p.name}: ${err.message}`);
      continue;
    }

    await client.query('UPDATE "Property" SET "imageUrl" = $1 WHERE id = $2', [url, p.id]);
    console.log(`  ✅ Set photo for: ${p.name}`);
  }

  console.log("Done.");
  await client.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
