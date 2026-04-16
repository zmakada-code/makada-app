import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/tenant-invite
 *
 * Provisions a Supabase auth user for a tenant with a specific password.
 * If the user already exists, updates their password instead.
 *
 * Body: { email: string, password: string }
 * Auth: x-intake-secret header
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-intake-secret");
  if (!secret || secret !== process.env.INQUIRY_INTAKE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const email = body.email?.trim()?.toLowerCase();
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json(
      { error: "email and password are required." },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  try {
    const supabase = createSupabaseAdminClient();

    // Check if user already exists
    const { data: existing } = await supabase.auth.admin.listUsers();
    const existingUser = existing?.users.find(
      (u) => u.email?.toLowerCase() === email
    );

    if (existingUser) {
      // Update existing user's password
      const { error } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        { password, email_confirm: true }
      );

      if (error) {
        console.error("[tenant-invite] update error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        ok: true,
        userId: existingUser.id,
        action: "updated",
      });
    }

    // Create new user with password, auto-confirm email
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "tenant" },
    });

    if (error) {
      console.error("[tenant-invite] create error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { ok: true, userId: data.user.id, action: "created" },
      { status: 201 }
    );
  } catch (err) {
    console.error("[tenant-invite] Unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to provision tenant account." },
      { status: 500 }
    );
  }
}
