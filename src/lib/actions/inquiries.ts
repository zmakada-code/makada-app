"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { InquirySource, InquiryStatus } from "@prisma/client";
import {
  requireString,
  optionalString,
  type FieldErrors,
} from "@/lib/validation";

const SOURCES: InquirySource[] = ["WEBSITE", "WALK_IN", "REFERRAL", "OTHER"];
const STATUSES: InquiryStatus[] = [
  "NEW",
  "CONTACTED",
  "TOURED",
  "REJECTED",
  "CONVERTED",
];

export type InquiryFormState = {
  errors?: FieldErrors;
  values?: {
    prospectName: string;
    phone: string;
    email: string;
    message: string;
    unitId: string;
    source: InquirySource;
    status: InquiryStatus;
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

function parseEnum<T extends string>(
  errors: FieldErrors,
  field: string,
  value: FormDataEntryValue | null,
  allowed: readonly T[]
): T {
  const raw = (value ?? "").toString().trim() as T;
  if (!allowed.includes(raw)) {
    errors[field] = "Invalid value.";
    return allowed[0];
  }
  return raw;
}

async function validateUnitIfProvided(
  errors: FieldErrors,
  unitId: string | null
) {
  if (!unitId) return;
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { id: true },
  });
  if (!unit) errors.unitId = "Unit not found.";
}

export async function createInquiry(
  _prev: InquiryFormState,
  formData: FormData
): Promise<InquiryFormState> {
  const errors: FieldErrors = {};
  const prospectName = requireString(errors, "prospectName", formData.get("prospectName"), {
    max: 160,
  });
  const phone = optionalString(formData.get("phone"), 40);
  const email = optionalString(formData.get("email"), 160);
  const message = optionalString(formData.get("message"), 4000);
  const unitId = optionalString(formData.get("unitId"), 64);
  const source = parseEnum(errors, "source", formData.get("source"), SOURCES);
  const status = parseEnum(errors, "status", formData.get("status"), STATUSES);
  validateEmail(errors, email);
  if (!phone && !email) {
    errors.phone = errors.phone ?? "Provide at least a phone or email.";
  }
  await validateUnitIfProvided(errors, unitId);

  if (Object.keys(errors).length) {
    return {
      errors,
      values: {
        prospectName,
        phone: phone ?? "",
        email: email ?? "",
        message: message ?? "",
        unitId: unitId ?? "",
        source,
        status,
      },
    };
  }

  const created = await prisma.inquiry.create({
    data: {
      prospectName,
      phone,
      email,
      message,
      unitId,
      source,
      status,
    },
  });

  revalidatePath("/inquiries");
  revalidatePath("/dashboard");
  if (unitId) {
    revalidatePath(`/units/${unitId}`);
  }
  redirect(flash(`/inquiries/${created.id}`, "Inquiry created."));
}

export async function updateInquiry(
  id: string,
  _prev: InquiryFormState,
  formData: FormData
): Promise<InquiryFormState> {
  const errors: FieldErrors = {};
  const prospectName = requireString(errors, "prospectName", formData.get("prospectName"), {
    max: 160,
  });
  const phone = optionalString(formData.get("phone"), 40);
  const email = optionalString(formData.get("email"), 160);
  const message = optionalString(formData.get("message"), 4000);
  const unitId = optionalString(formData.get("unitId"), 64);
  const source = parseEnum(errors, "source", formData.get("source"), SOURCES);
  const status = parseEnum(errors, "status", formData.get("status"), STATUSES);
  validateEmail(errors, email);
  if (!phone && !email) {
    errors.phone = errors.phone ?? "Provide at least a phone or email.";
  }
  await validateUnitIfProvided(errors, unitId);

  if (Object.keys(errors).length) {
    return {
      errors,
      values: {
        prospectName,
        phone: phone ?? "",
        email: email ?? "",
        message: message ?? "",
        unitId: unitId ?? "",
        source,
        status,
      },
    };
  }

  await prisma.inquiry.update({
    where: { id },
    data: {
      prospectName,
      phone,
      email,
      message,
      unitId,
      source,
      status,
    },
  });

  revalidatePath("/inquiries");
  revalidatePath(`/inquiries/${id}`);
  revalidatePath("/dashboard");
  if (unitId) revalidatePath(`/units/${unitId}`);
  redirect(flash(`/inquiries/${id}`, "Inquiry updated."));
}

export async function setInquiryStatus(formData: FormData) {
  const id = formData.get("id")?.toString();
  const status = formData.get("status")?.toString();
  const inline = formData.get("inline")?.toString() === "1";
  if (!id || !STATUSES.includes(status as InquiryStatus)) return;

  await prisma.inquiry.update({
    where: { id },
    data: { status: status as InquiryStatus },
  });

  revalidatePath("/inquiries");
  revalidatePath(`/inquiries/${id}`);
  revalidatePath("/dashboard");
  if (inline) return;
  redirect(flash(`/inquiries/${id}`, `Status set to ${status}.`));
}

export async function deleteInquiry(formData: FormData) {
  const id = formData.get("id")?.toString();
  if (!id) return;

  await prisma.inquiry.delete({ where: { id } });
  revalidatePath("/inquiries");
  revalidatePath("/dashboard");
  redirect(flash("/inquiries", "Inquiry deleted."));
}

/**
 * Lightweight programmatic creator used by the internal API route.
 * Throws on validation failure rather than returning form state.
 */
export async function createInquiryFromPayload(input: {
  prospectName: string;
  phone?: string | null;
  email?: string | null;
  message?: string | null;
  unitId?: string | null;
  source?: InquirySource;
}) {
  const name = (input.prospectName ?? "").toString().trim();
  if (!name) throw new Error("prospectName is required.");
  const phone = input.phone?.toString().trim() || null;
  const email = input.email?.toString().trim() || null;
  if (!phone && !email) throw new Error("Provide at least a phone or email.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Invalid email.");
  }
  const source: InquirySource =
    input.source && SOURCES.includes(input.source) ? input.source : "WEBSITE";
  const unitId = input.unitId?.toString().trim() || null;
  if (unitId) {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true },
    });
    if (!unit) throw new Error("Unit not found.");
  }

  const created = await prisma.inquiry.create({
    data: {
      prospectName: name.slice(0, 160),
      phone: phone?.slice(0, 40) ?? null,
      email: email?.slice(0, 160) ?? null,
      message: input.message?.toString().slice(0, 4000) ?? null,
      unitId,
      source,
      status: "NEW",
    },
  });

  revalidatePath("/inquiries");
  revalidatePath("/dashboard");
  return created;
}
