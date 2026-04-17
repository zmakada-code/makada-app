/**
 * Fetches a Google Street View image for each property (that doesn't
 * already have a photo) and uploads it to Supabase Storage.
 *
 * Prerequisites:
 *   1. A Google Maps API key with Street View Static API enabled.
 *      Get one at: https://console.cloud.google.com/google/maps-apis
 *   2. npm install @supabase/supabase-js  (already installed in the project)
 *
 * Usage:
 *   GOOGLE_MAPS_KEY=AIza... node fetch-property-photos.mjs
 *
 * Or to skip a specific property (e.g. a test property):
 *   GOOGLE_MAPS_KEY=AIza... SKIP_PROPERTY="Test Property" node fetch-property-photos.mjs
 */

import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const { Client } = pg;

const DATABASE_URL =
  "postgresql://postgres.qitktpzegtpjkpjdkjka:TRjCT4IryUbyacZl@aws-1-us-east-2.pooler.supabase.com:5432/postgres";

const SUPABASE_URL = "https://qitktpzegtpjkpjdkjka.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_KEY = process.env.GOOGLE_MAPS_KEY;
const SKIP = process.env.SKIP_PROPERTY?.toLowerCase();
const BUCKET = "documents";

if (!GOOGLE_KEY) {
  console.error(
    "Missing GOOGLE_MAPS_KEY. Set it as an env var:\n" +
      "  GOOGLE_MAPS_KEY=AIza... node fetch-property-photos.mjs\n\n" +
      "Get a key at https://console.cloud.google.com/google/maps-apis\n" +
      "Enable the 'Street View Static API'."
  );
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  console.error(
    "Missing SUPABASE_SERVICE_ROLE_KEY. Find it in your Supabase dashboard → Settings → API."
  );
  process.exit(1);
}

const dbClient = new Client({ connectionString: DATABASE_URL });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function fetchStreetView(address) {
  const url = new URL("https://maps.googleapis.com/maps/api/streetview");
  url.searchParams.set("size", "800x500");
  url.searchParams.set("location", address);
  url.searchParams.set("fov", "90");
  url.searchParams.set("pitch", "10");
  url.searchParams.set("key", GOOGLE_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Street View API returned ${res.status}`);
  }

  // Check if we got an actual image (not the "no image available" response)
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    throw new Error("No Street View image available for this address");
  }

  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  await dbClient.connect();
  console.log("Connected to database.\n");

  const { rows: properties } = await dbClient.query(
    `SELECT id, name, address, "imageUrl" FROM "Property" ORDER BY name`
  );

  console.log(`Found ${properties.length} properties.\n`);

  for (const prop of properties) {
    // Skip test properties
    if (SKIP && prop.name.toLowerCase().includes(SKIP)) {
      console.log(`⏭  Skipping "${prop.name}" (matches SKIP_PROPERTY)`);
      continue;
    }

    // Skip if already has an image
    if (prop.imageUrl) {
      console.log(`✓  "${prop.name}" already has a photo.`);
      continue;
    }

    console.log(`📸 Fetching Street View for "${prop.name}" at ${prop.address}...`);

    try {
      const imageBuffer = await fetchStreetView(prop.address);
      const storagePath = `property/${prop.id}/${crypto.randomUUID()}-streetview.jpg`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, imageBuffer, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        console.error(`   ❌ Upload failed: ${uploadError.message}`);
        continue;
      }

      // Save storage path to property
      await dbClient.query(
        `UPDATE "Property" SET "imageUrl" = $1 WHERE id = $2`,
        [storagePath, prop.id]
      );

      console.log(`   ✅ Saved to ${storagePath}`);
    } catch (err) {
      console.error(`   ❌ Failed: ${err.message}`);
    }
  }

  console.log("\nDone!");
}

main()
  .catch((e) => {
    console.error("Failed:", e);
    process.exit(1);
  })
  .finally(() => dbClient.end());
