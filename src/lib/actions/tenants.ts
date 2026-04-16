"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requireString,
  optionalString,
  type FieldErrors,
} from "@/lib/validation";

export type TenantFormState = {
  errors?: FieldErrors;
  values?: {
    fullName: string;
    phone: string;
    email: string;
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
        notes: notes ?? "",
        turbotenantReference: turbotenantReference ?? "",
      },
    };
  }

  const created = await prisma.tenant.create({
    data: { fullName, phone, email, notes, turbotenantReference },
  });

  // Auto-invite tenant to the portal if they have an email
  if (email) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      await fetch(`${baseUrl}/api/tenant-invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-intake-secret": process.env.INQUIRY_INTAKE_SECRET ?? "",
        },
        body: JSON.stringify({ email }),
      });
    } catch (err) {
      // Don't block tenant creation if invite fails — log and continue.
      console.error("[createTenant] Portal invite failed:", err);
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

export async function deleteTenant(formData: FormData) {
  const id = formData.get("id")?.toString();
  if (!id) return;

  // Don't let a tenant with an active lease be deleted outright.
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

  await prisma.tenant.delete({ where: { id } });
  revalidatePath("/tenants");
  revalidatePath("/dashboard");
  redirect(flash("/tenants", "Tenant deleted."));
}
