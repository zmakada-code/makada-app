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
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(storagePath, expiresIn);
    if (error) {
      console.error(`[supabase] signed URL error for "${storagePath}":`, error.message);
      return null;
    }
    if (!data) return null;
    return data.signedUrl;
  } catch (err) {
    console.error(`[supabase] getSignedDocumentUrl failed for "${storagePath}":`, err);
    return null;
  }
}

/** Get a public URL for an object (no expiry, requires bucket to have public access or use signed). */
export function getPublicDocumentUrl(storagePath: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  return `${url}/storage/v1/object/public/${DOCUMENTS_BUCKET}/${storagePath}`;
}
