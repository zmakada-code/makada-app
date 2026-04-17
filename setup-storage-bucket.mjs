/**
 * Creates the "documents" storage bucket in Supabase if it doesn't exist.
 * Run: node setup-storage-bucket.mjs
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://qitktpzegtpjkpjdkjka.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpdGt0cHplZ3RwamtwamRramthIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI0NDMwMCwiZXhwIjoyMDkxODIwMzAwfQ.XG32lPJJBIgE4pvxmwnpZwQjW5td78InijRz_vsHJ3s";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Check if bucket exists
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error("❌ Failed to list buckets:", listError.message);
    process.exit(1);
  }

  const existing = buckets?.find(b => b.name === "documents");

  if (existing) {
    console.log("✅ 'documents' bucket already exists.");
    return;
  }

  // Create the bucket
  const { data, error } = await supabase.storage.createBucket("documents", {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ],
  });

  if (error) {
    console.error("❌ Failed to create bucket:", error.message);
    process.exit(1);
  }

  console.log("✅ 'documents' storage bucket created successfully.", data);
}

main();
