/**
 * Sets property photo URLs to local static files in /property-photos/.
 *
 * Before running:
 *   1. Place your photos in public/property-photos/ with the names below
 *   2. Accepts .jpg, .jpeg, or .png extensions
 *
 * Usage:
 *   node set-property-photos-static.mjs
 */

import pg from "pg";
import fs from "fs";
import path from "path";
const { Client } = pg;

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres.qitktpzegtpjkpjdkjka:TRjCT4IryUbyacZl@aws-1-us-east-2.pooler.supabase.com:5432/postgres";

// Map: address substring → photo filename (without extension)
const PHOTO_MAP = [
  { match: "montgomery",     file: "montgomery-avenue" },
  { match: "1110 haddon",    file: "1110-haddon-drive" },
  { match: "haddon",         file: "1110-haddon-drive" },
  { match: "humbolt",        file: "humbolt-street" },
  { match: "humboldt",       file: "humbolt-street" },
  { match: "railroad",       file: "railroad-avenue" },
  { match: "lakeview",       file: "lakeview-way" },
  { match: "500 n san mateo", file: "500-n-san-mateo-drive" },
  { match: "500 n. san mateo", file: "500-n-san-mateo-drive" },
  { match: "circle court",   file: "circle-court" },
  { match: "circle",         file: "circle-court" },
];

const PHOTO_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), "public", "property-photos");

function findPhotoFile(baseName) {
  for (const ext of [".jpg", ".jpeg", ".png", ".webp"]) {
    const filePath = path.join(PHOTO_DIR, baseName + ext);
    if (fs.existsSync(filePath)) return baseName + ext;
  }
  return null;
}

async function run() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log("Connected to database.");

  const { rows: properties } = await client.query(
    'SELECT id, name, address, "imageUrl" FROM "Property" ORDER BY name'
  );

  console.log(`Found ${properties.length} properties.\n`);

  let updated = 0;
  for (const p of properties) {
    if (p.name.toLowerCase().includes("test")) {
      console.log(`  Skipping test property: ${p.name}`);
      continue;
    }

    const nameAndAddress = `${p.name} ${p.address}`.toLowerCase();
    const mapping = PHOTO_MAP.find((m) => nameAndAddress.includes(m.match));

    if (!mapping) {
      console.log(`  No mapping found for: ${p.name} (${p.address})`);
      continue;
    }

    const photoFileName = findPhotoFile(mapping.file);
    if (!photoFileName) {
      console.log(`  Photo file not found for: ${p.name} — expected ${mapping.file}.[jpg|png] in public/property-photos/`);
      continue;
    }

    const imageUrl = `/property-photos/${photoFileName}`;

    await client.query('UPDATE "Property" SET "imageUrl" = $1 WHERE id = $2', [imageUrl, p.id]);
    console.log(`  ✅ ${p.name} → ${imageUrl}`);
    updated++;
  }

  console.log(`\nDone. Updated ${updated} properties.`);
  await client.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
