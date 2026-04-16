"use server";

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/tenant-invite
 * Called internally by the createTenant server action after a tenant is created.
 * Sends a magic-link invite to the tenant's email via Supabase auth.
 *
 * Body: { email: string }
 * Auth: x-intake-secret header (same secret as inquiry intake)
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-intake-secret");
  if (!secret || secret !== process.env.INQUIRY_INTAKE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const email = body.email?.trim()?.toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const redirectTo = process.env.TENANT_PORTAL_URL
    ? `${process.env.TENANT_PORTAL_URL}/auth/callback`
    : undefined;

  if (!redirectTo) {
    console.error("[tenant-invite] TENANT_PORTAL_URL is not set");
    return NextResponse.json(
      { error: "Tenant portal URL not configured." },
      { status: 500 }
    );
  }

  try {
    const supabase = createSupabaseAdminClient();

    // inviteUserByEmail creates the auth user and sends a magic link.
    // If the user already exists in auth, it re-sends the invite.
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { role: "tenant" },
    });

    if (error) {
      console.error("[tenant-invite] Supabase error:", error.message);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.log(`[tenant-invite] Invited ${email}, auth user id: ${data.user.id}`);
    return NextResponse.json({ ok: true, userId: data.user.id }, { status: 201 });
  } catch (err) {
    console.error("[tenant-invite] Unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to send invite." },
      { status: 500 }
    );
  }
}
