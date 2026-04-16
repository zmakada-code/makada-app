import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the service role key.
 * NEVER expose this to the browser.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase admin env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const DOCUMENTS_BUCKET = "documents";

/** Generate a short-lived signed URL for an object in the documents bucket. */
export async function getSignedDocumentUrl(storagePath: string, expiresIn = 60 * 10) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  if (error || !data) return null;
  return data.signedUrl;
}
