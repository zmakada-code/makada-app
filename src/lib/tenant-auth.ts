import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Look up a Supabase auth user by email.
 * Returns the user object if found, otherwise null.
 */
async function findUserByEmail(email: string) {
  const supabase = createSupabaseAdminClient();
  const normalized = email.trim().toLowerCase();
  const { data } = await supabase.auth.admin.listUsers();
  return (
    data?.users.find((u) => u.email?.toLowerCase() === normalized) ?? null
  );
}

/**
 * Create or update a Supabase auth account with the given email + password.
 * Returns the user id.
 */
export async function provisionTenantAuth(
  email: string,
  password: string
): Promise<{ userId: string; action: "created" | "updated" }> {
  const supabase = createSupabaseAdminClient();
  const normalized = email.trim().toLowerCase();

  const existing = await findUserByEmail(normalized);
  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    return { userId: existing.id, action: "updated" };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: normalized,
    password,
    email_confirm: true,
    user_metadata: { role: "tenant" },
  });
  if (error || !data.user) throw new Error(error?.message ?? "Failed to create user.");
  return { userId: data.user.id, action: "created" };
}

/**
 * Lock (ban) or unlock the Supabase auth account for a tenant.
 * Locking is implemented with a very long ban_duration.
 */
export async function setTenantAuthLock(
  authUserId: string,
  locked: boolean
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(authUserId, {
    // 100 years ≈ permanent lock. "none" clears any ban.
    ban_duration: locked ? "876000h" : "none",
  });
  if (error) throw new Error(error.message);
}

/**
 * Delete the Supabase auth user for a tenant. Silently returns if the
 * user can't be found (already deleted).
 */
export async function deleteTenantAuth(authUserIdOrEmail: {
  userId?: string | null;
  email?: string | null;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  let userId = authUserIdOrEmail.userId ?? null;
  if (!userId && authUserIdOrEmail.email) {
    const user = await findUserByEmail(authUserIdOrEmail.email);
    userId = user?.id ?? null;
  }
  if (!userId) return;

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error && !/not found/i.test(error.message)) throw new Error(error.message);
}
