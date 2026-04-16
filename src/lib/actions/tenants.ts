"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requireString,
  optionalString,
  type FieldErrors,
} from "@/lib/validation";
import {
  provisionTenantAuth,
  setTenantAuthLock,
  deleteTenantAuth,
} from "@/lib/tenant-auth";

export type TenantFormState = {
  errors?: FieldErrors;
  values?: {
    fullName: string;
    phone: string;
    email: string;
    password: string;
    notes: string;
    turbotenantReference: string;
  };
};

function flash(path: string, message: string, type: "success" | "error" = "success") {
  const qs = new URLSearchParams({ flash: message, flashType: type }).toString();
  return `${path}?${qs}`;
}

function validateEmail(errors: FieldErrors, value: string | null) {
  if (!value) return;
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (!ok) errors.email = "Not a valid email.";
}

export async function createTenant(
  _prev: TenantFormState,
  formData: FormData
): Promise<TenantFormState> {
  const errors: FieldErrors = {};
  const fullName = requireString(errors, "fullName", formData.get("fullName"), { max: 160 });
  const phone = optionalString(formData.get("phone"), 40);
  const email = optionalString(formData.get("email"), 160);
  const password = optionalString(formData.get("password"));
  const notes = optionalString(formData.get("notes"));
  const turbotenantReference = optionalString(formData.get("turbotenantReference"), 500);
  validateEmail(errors, email);

  if (password) {
    if (!email) {
      errors.password = "An email is required to set a password.";
    }
    if (password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    }
  }

  if (Object.keys(errors).length) {
    return {
      errors,
      values: {
        fullName,
        phone: phone ?? "",
        email: email ?? "",
        password: password ?? "",
        notes: notes ?? "",
        turbotenantReference: turbotenantReference ?? "",
      },
    };
  }

  const created = await prisma.tenant.create({
    data: { fullName, phone, email, notes, turbotenantReference },
  });

  if (email && password) {
    try {
      const { userId } = await provisionTenantAuth(email, password);
      await prisma.tenant.update({
        where: { id: created.id },
        data: {
          portalPassword: password,
          authUserId: userId,
          authLocked: false,
        },
      });
    } catch (err) {
      console.error("[createTenant] Auth provisioning error:", err);
      redirect(
        flash(
          `/tenants/${created.id}`,
          "Tenant created, but portal account failed to provision. Set a password from the tenant page.",
          "error"
        )
      );
    }
  }

  revalidatePath("/tenants");
  revalidatePath("/dashboard");
  redirect(flash(`/tenants/${created.id}`, "Tenant created."));
}

export async function updateTenant(
  id: string,
  _prev: TenantFormState,
  formData: FormData
): Promise<TenantFormState> {
  const errors: FieldErrors = {};
  const fullName = requireString(errors, "fullName", formData.get("fullName"), { max: 160 });
  const phone = optionalString(formData.get("phone"), 40);
  const email = optionalString(formData.get("email"), 160);
  const notes = optionalString(formData.get("notes"));
  const turbotenantReference = optionalString(formData.get("turbotenantReference"), 500);
  validateEmail(errors, email);

  if (Object.keys(errors).length) {
    return {
      errors,
      values: {
        fullName,
        phone: phone ?? "",
        email: email ?? "",
        password: "",
        notes: notes ?? "",
        turbotenantReference: turbotenantReference ?? "",
      },
    };
  }

  await prisma.tenant.update({
    where: { id },
    data: { fullName, phone, email, notes, turbotenantReference },
  });

  revalidatePath("/tenants");
  revalidatePath(`/tenants/${id}`);
  redirect(flash(`/tenants/${id}`, "Tenant updated."));
}

/**
 * Set or reset a tenant's portal password.
 * Persists the plaintext to Tenant.portalPassword so the admin can see it.
 */
export async function setTenantPassword(
  _prev: { error?: string; success?: string },
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  const id = formData.get("id")?.toString();
  const password = formData.get("password")?.toString() ?? "";

  if (!id) return { error: "Missing tenant id." };
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) return { error: "Tenant not found." };
  if (!tenant.email) {
    return { error: "This tenant has no email on file. Add one first." };
  }

  try {
    const { userId } = await provisionTenantAuth(tenant.email, password);
    await prisma.tenant.update({
      where: { id },
      data: {
        portalPassword: password,
        authUserId: userId,
        authLocked: false,
      },
    });
    revalidatePath(`/tenants/${id}`);
    return { success: "Password updated." };
  } catch (err) {
    console.error("[setTenantPassword] error:", err);
    return {
      error: err instanceof Error ? err.message : "Failed to set password.",
    };
  }
}

/**
 * Lock or unlock the tenant's portal account.
 * Pass formData with { id, locked: "true" | "false" }.
 */
export async function setTenantLocked(
  _prev: { error?: string; success?: string },
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  const id = formData.get("id")?.toString();
  const locked = formData.get("locked")?.toString() === "true";
  if (!id) return { error: "Missing tenant id." };

  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) return { error: "Tenant not found." };
  if (!tenant.authUserId) {
    return { error: "No portal account found. Set a password first." };
  }

  try {
    await setTenantAuthLock(tenant.authUserId, locked);
    await prisma.tenant.update({
      where: { id },
      data: { authLocked: locked },
    });
    revalidatePath(`/tenants/${id}`);
    return { success: locked ? "Account locked." : "Account unlocked." };
  } catch (err) {
    console.error("[setTenantLocked] error:", err);
    return {
      error: err instanceof Error ? err.message : "Failed to update account state.",
    };
  }
}

export async function deleteTenant(formData: FormData) {
  const id = formData.get("id")?.toString();
  if (!id) return;

  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) return;

  const activeLeases = await prisma.lease.count({
    where: { tenantId: id, status: "ACTIVE" },
  });
  if (activeLeases > 0) {
    redirect(
      flash(
        `/tenants/${id}`,
        "Can't delete: tenant has an active lease. End the lease first.",
        "error"
      )
    );
  }

  // Best-effort cleanup of the Supabase auth user
  try {
    await deleteTenantAuth({ userId: tenant.authUserId, email: tenant.email });
  } catch (err) {
    console.error("[deleteTenant] Auth cleanup error:", err);
  }

  await prisma.tenant.delete({ where: { id } });
  revalidatePath("/tenants");
  revalidatePath("/dashboard");
  redirect(flash("/tenants", "Tenant deleted."));
}
