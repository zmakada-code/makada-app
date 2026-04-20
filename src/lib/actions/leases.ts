"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { LeaseStatus, Prisma } from "@prisma/client";
import {
  requireString,
  optionalString,
  parseNumber,
  type FieldErrors,
} from "@/lib/validation";

const LEASE_STATUSES: LeaseStatus[] = ["ACTIVE", "UPCOMING", "ENDED", "TERMINATED"];

const LEASE_TYPES = ["YEAR_TO_YEAR", "MONTH_TO_MONTH"] as const;

export type LeaseFormState = {
  errors?: FieldErrors;
  values?: {
    tenantId: string;
    unitId: string;
    startDate: string;
    endDate: string;
    monthlyRent: string;
    leaseType: string;
    status: string;
    notes: string;
  };
};

function flash(path: string, message: string, type: "success" | "error" = "success") {
  const qs = new URLSearchParams({ flash: message, flashType: type }).toString();
  return `${path}?${qs}`;
}

function parseDate(errors: FieldErrors, field: string, value: FormDataEntryValue | null): Date {
  const raw = (value ?? "").toString().trim();
  if (!raw) {
    errors[field] = "Required.";
    return new Date(0);
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    errors[field] = "Invalid date.";
    return new Date(0);
  }
  return d;
}

function parseStatus(errors: FieldErrors, value: FormDataEntryValue | null): LeaseStatus {
  const raw = (value ?? "").toString();
  if (!LEASE_STATUSES.includes(raw as LeaseStatus)) {
    errors.status = "Invalid status.";
    return "UPCOMING";
  }
  return raw as LeaseStatus;
}

/** Ensure only one ACTIVE lease per unit. */
async function assertNoOverlappingActive(
  tx: Prisma.TransactionClient,
  unitId: string,
  excludeLeaseId?: string
) {
  const clash = await tx.lease.findFirst({
    where: {
      unitId,
      status: "ACTIVE",
      ...(excludeLeaseId ? { NOT: { id: excludeLeaseId } } : {}),
    },
    select: { id: true },
  });
  if (clash) {
    throw new Error(
      "This unit already has an active lease. End or terminate the existing lease first."
    );
  }
}

export async function createLease(
  _prev: LeaseFormState,
  formData: FormData
): Promise<LeaseFormState> {
  const errors: FieldErrors = {};
  const tenantId = requireString(errors, "tenantId", formData.get("tenantId"));
  const unitId = requireString(errors, "unitId", formData.get("unitId"));
  const startDate = parseDate(errors, "startDate", formData.get("startDate"));
  const endDate = parseDate(errors, "endDate", formData.get("endDate"));
  const monthlyRent = parseNumber(errors, "monthlyRent", formData.get("monthlyRent"));
  const leaseTypeRaw = (formData.get("leaseType") ?? "YEAR_TO_YEAR").toString();
  const leaseType = LEASE_TYPES.includes(leaseTypeRaw as typeof LEASE_TYPES[number])
    ? leaseTypeRaw
    : "YEAR_TO_YEAR";
  const status = parseStatus(errors, formData.get("status"));
  const notes = optionalString(formData.get("notes"));

  if (
    !errors.startDate &&
    !errors.endDate &&
    endDate.getTime() <= startDate.getTime()
  ) {
    errors.endDate = "End date must be after start date.";
  }

  const values = {
    tenantId,
    unitId,
    startDate: formData.get("startDate")?.toString() ?? "",
    endDate: formData.get("endDate")?.toString() ?? "",
    monthlyRent: String(monthlyRent),
    leaseType,
    status,
    notes: notes ?? "",
  };

  if (Object.keys(errors).length) return { errors, values };

  try {
    const created = await prisma.$transaction(async (tx) => {
      if (status === "ACTIVE") {
        await assertNoOverlappingActive(tx, unitId);
      }
      const lease = await tx.lease.create({
        data: { tenantId, unitId, startDate, endDate, monthlyRent, leaseType, status, notes },
      });
      if (status === "ACTIVE") {
        await tx.unit.update({
          where: { id: unitId },
          data: { occupancyStatus: "OCCUPIED", isPublished: false },
        });
      }
      return lease;
    });

    revalidatePath("/leases");
    revalidatePath("/tenants");
    revalidatePath(`/tenants/${tenantId}`);
    revalidatePath("/units");
    revalidatePath("/zillow-rentals");
    revalidatePath("/dashboard");
    redirect(flash(`/leases/${created.id}/edit`, "Lease created."));
  } catch (err) {
    if (err instanceof Error && err.message.includes("active lease")) {
      return { errors: { unitId: err.message }, values };
    }
    throw err;
  }
}

export async function updateLease(
  id: string,
  _prev: LeaseFormState,
  formData: FormData
): Promise<LeaseFormState> {
  const errors: FieldErrors = {};
  const tenantId = requireString(errors, "tenantId", formData.get("tenantId"));
  const unitId = requireString(errors, "unitId", formData.get("unitId"));
  const startDate = parseDate(errors, "startDate", formData.get("startDate"));
  const endDate = parseDate(errors, "endDate", formData.get("endDate"));
  const monthlyRent = parseNumber(errors, "monthlyRent", formData.get("monthlyRent"));
  const leaseTypeRaw = (formData.get("leaseType") ?? "YEAR_TO_YEAR").toString();
  const leaseType = LEASE_TYPES.includes(leaseTypeRaw as typeof LEASE_TYPES[number])
    ? leaseTypeRaw
    : "YEAR_TO_YEAR";
  const status = parseStatus(errors, formData.get("status"));
  const notes = optionalString(formData.get("notes"));

  if (
    !errors.startDate &&
    !errors.endDate &&
    endDate.getTime() <= startDate.getTime()
  ) {
    errors.endDate = "End date must be after start date.";
  }

  const values = {
    tenantId,
    unitId,
    startDate: formData.get("startDate")?.toString() ?? "",
    endDate: formData.get("endDate")?.toString() ?? "",
    monthlyRent: String(monthlyRent),
    leaseType,
    status,
    notes: notes ?? "",
  };

  if (Object.keys(errors).length) return { errors, values };

  try {
    await prisma.$transaction(async (tx) => {
      const prior = await tx.lease.findUniqueOrThrow({ where: { id } });

      if (status === "ACTIVE") {
        await assertNoOverlappingActive(tx, unitId, id);
      }

      await tx.lease.update({
        where: { id },
        data: { tenantId, unitId, startDate, endDate, monthlyRent, leaseType, status, notes },
      });

      // Side effects on unit occupancy
      const unitChanged = prior.unitId !== unitId;

      if (unitChanged && prior.status === "ACTIVE") {
        // Free up the old unit if no other active lease remains on it.
        const stillActive = await tx.lease.count({
          where: { unitId: prior.unitId, status: "ACTIVE" },
        });
        if (stillActive === 0) {
          await tx.unit.update({
            where: { id: prior.unitId },
            data: { occupancyStatus: "TURNOVER" },
          });
        }
      }

      if (status === "ACTIVE") {
        await tx.unit.update({
          where: { id: unitId },
          data: { occupancyStatus: "OCCUPIED", isPublished: false },
        });
      } else if (prior.status === "ACTIVE") {
        // Lease left ACTIVE on the same unit — flip it to TURNOVER if no other active lease exists.
        const stillActive = await tx.lease.count({
          where: { unitId, status: "ACTIVE" },
        });
        if (stillActive === 0) {
          await tx.unit.update({ where: { id: unitId }, data: { occupancyStatus: "TURNOVER" } });
        }
      }
    });

    revalidatePath("/leases");
    revalidatePath(`/leases/${id}/edit`);
    revalidatePath("/tenants");
    revalidatePath(`/tenants/${tenantId}`);
    revalidatePath("/units");
    revalidatePath("/zillow-rentals");
    revalidatePath("/dashboard");
    redirect(flash(`/leases/${id}/edit`, "Lease updated."));
  } catch (err) {
    if (err instanceof Error && err.message.includes("active lease")) {
      return { errors: { unitId: err.message }, values };
    }
    throw err;
  }
}

export async function endLease(formData: FormData) {
  const id = formData.get("id")?.toString();
  if (!id) return;

  await prisma.$transaction(async (tx) => {
    const lease = await tx.lease.findUniqueOrThrow({ where: { id } });
    await tx.lease.update({
      where: { id },
      data: { status: "ENDED", endDate: new Date() },
    });
    const stillActive = await tx.lease.count({
      where: { unitId: lease.unitId, status: "ACTIVE" },
    });
    if (stillActive === 0) {
      await tx.unit.update({
        where: { id: lease.unitId },
        data: { occupancyStatus: "TURNOVER" },
      });
    }
  });

  revalidatePath("/leases");
  revalidatePath(`/leases/${id}/edit`);
  revalidatePath("/tenants");
  revalidatePath("/units");
  revalidatePath("/zillow-rentals");
  revalidatePath("/dashboard");
  redirect(flash(`/leases/${id}/edit`, "Lease ended."));
}

export async function deleteLease(formData: FormData) {
  const id = formData.get("id")?.toString();
  if (!id) return;

  await prisma.$transaction(async (tx) => {
    const lease = await tx.lease.findUniqueOrThrow({ where: { id } });
    await tx.lease.delete({ where: { id } });
    if (lease.status === "ACTIVE") {
      const stillActive = await tx.lease.count({
        where: { unitId: lease.unitId, status: "ACTIVE" },
      });
      if (stillActive === 0) {
        await tx.unit.update({
          where: { id: lease.unitId },
          data: { occupancyStatus: "VACANT" },
        });
      }
    }
  });

  revalidatePath("/leases");
  revalidatePath("/tenants");
  revalidatePath("/units");
  revalidatePath("/zillow-rentals");
  revalidatePath("/dashboard");
  redirect(flash("/leases", "Lease deleted."));
}
