"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { OccupancyStatus } from "@prisma/client";
import {
  requireString,
  optionalString,
  parseNumber,
  type FieldErrors,
} from "@/lib/validation";

const OCCUPANCY: OccupancyStatus[] = ["VACANT", "OCCUPIED", "TURNOVER"];

export type UnitFormState = {
  errors?: FieldErrors;
  values?: {
    label: string;
    bedrooms: string;
    bathrooms: string;
    rentAmount: string;
    depositAmount: string;
    occupancyStatus: string;
    notes: string;
  };
};

function flash(path: string, message: string, type: "success" | "error" = "success") {
  const qs = new URLSearchParams({ flash: message, flashType: type }).toString();
  return `${path}?${qs}`;
}

function parseOccupancy(errors: FieldErrors, value: FormDataEntryValue | null): OccupancyStatus {
  const raw = (value ?? "").toString();
  if (!OCCUPANCY.includes(raw as OccupancyStatus)) {
    errors.occupancyStatus = "Invalid status.";
    return "VACANT";
  }
  return raw as OccupancyStatus;
}

export async function createUnit(
  propertyId: string,
  _prev: UnitFormState,
  formData: FormData
): Promise<UnitFormState> {
  const errors: FieldErrors = {};
  const label = requireString(errors, "label", formData.get("label"), { max: 60 });
  const bedrooms = parseNumber(errors, "bedrooms", formData.get("bedrooms"), { integer: true });
  const bathrooms = parseNumber(errors, "bathrooms", formData.get("bathrooms"));
  const rentAmount = parseNumber(errors, "rentAmount", formData.get("rentAmount"));
  const depositAmount = parseNumber(errors, "depositAmount", formData.get("depositAmount"));
  const occupancyStatus = parseOccupancy(errors, formData.get("occupancyStatus"));
  const notes = optionalString(formData.get("notes"));

  if (Object.keys(errors).length) {
    return {
      errors,
      values: {
        label,
        bedrooms: String(bedrooms),
        bathrooms: String(bathrooms),
        rentAmount: String(rentAmount),
        depositAmount: String(depositAmount),
        occupancyStatus,
        notes: notes ?? "",
      },
    };
  }

  await prisma.unit.create({
    data: {
      propertyId,
      label,
      bedrooms,
      bathrooms,
      rentAmount,
      depositAmount,
      occupancyStatus,
      notes,
    },
  });

  revalidatePath(`/properties/${propertyId}`);
  revalidatePath("/units");
  revalidatePath("/zillow-rentals");
  revalidatePath("/dashboard");
  redirect(flash(`/properties/${propertyId}`, "Unit created."));
}

export async function updateUnit(
  id: string,
  _prev: UnitFormState,
  formData: FormData
): Promise<UnitFormState> {
  const errors: FieldErrors = {};
  const label = requireString(errors, "label", formData.get("label"), { max: 60 });
  const bedrooms = parseNumber(errors, "bedrooms", formData.get("bedrooms"), { integer: true });
  const bathrooms = parseNumber(errors, "bathrooms", formData.get("bathrooms"));
  const rentAmount = parseNumber(errors, "rentAmount", formData.get("rentAmount"));
  const depositAmount = parseNumber(errors, "depositAmount", formData.get("depositAmount"));
  const occupancyStatus = parseOccupancy(errors, formData.get("occupancyStatus"));
  const notes = optionalString(formData.get("notes"));

  if (Object.keys(errors).length) {
    return {
      errors,
      values: {
        label,
        bedrooms: String(bedrooms),
        bathrooms: String(bathrooms),
        rentAmount: String(rentAmount),
        depositAmount: String(depositAmount),
        occupancyStatus,
        notes: notes ?? "",
      },
    };
  }

  // Auto-unpublish if unit is no longer vacant
  const autoUnpublish = occupancyStatus !== "VACANT" ? { isPublished: false } : {};

  const updated = await prisma.unit.update({
    where: { id },
    data: {
      label,
      bedrooms,
      bathrooms,
      rentAmount,
      depositAmount,
      occupancyStatus,
      notes,
      ...autoUnpublish,
    },
  });

  revalidatePath("/units");
  revalidatePath(`/properties/${updated.propertyId}`);
  revalidatePath("/zillow-rentals");
  revalidatePath("/dashboard");
  redirect(flash(`/properties/${updated.propertyId}`, "Unit updated."));
}

export async function deleteUnit(formData: FormData) {
  const id = formData.get("id")?.toString();
  if (!id) return;

  const unit = await prisma.unit.findUnique({
    where: { id },
    select: { propertyId: true },
  });
  if (!unit) {
    redirect(flash("/units", "Unit not found.", "error"));
  }

  const activeLeases = await prisma.lease.count({
    where: { unitId: id, status: "ACTIVE" },
  });
  if (activeLeases > 0) {
    redirect(
      flash(
        `/properties/${unit.propertyId}`,
        "Can't delete: this unit has an active lease. End the lease first.",
        "error"
      )
    );
  }

  await prisma.unit.delete({ where: { id } });
  revalidatePath("/units");
  revalidatePath(`/properties/${unit.propertyId}`);
  revalidatePath("/zillow-rentals");
  revalidatePath("/dashboard");
  redirect(flash(`/properties/${unit.propertyId}`, "Unit deleted."));
}
