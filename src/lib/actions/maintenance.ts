"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { TicketPriority, TicketStatus } from "@prisma/client";
import {
  requireString,
  optionalString,
  type FieldErrors,
} from "@/lib/validation";

const PRIORITIES: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED"];

export type TicketFormState = {
  errors?: FieldErrors;
  values?: {
    unitId: string;
    tenantId: string;
    title: string;
    description: string;
    priority: string;
    status: string;
  };
};

function flash(path: string, message: string, type: "success" | "error" = "success") {
  const qs = new URLSearchParams({ flash: message, flashType: type }).toString();
  return `${path}?${qs}`;
}

function parsePriority(errors: FieldErrors, v: FormDataEntryValue | null): TicketPriority {
  const raw = (v ?? "").toString();
  if (!PRIORITIES.includes(raw as TicketPriority)) {
    errors.priority = "Invalid priority.";
    return "MEDIUM";
  }
  return raw as TicketPriority;
}

function parseStatus(errors: FieldErrors, v: FormDataEntryValue | null): TicketStatus {
  const raw = (v ?? "").toString();
  if (!STATUSES.includes(raw as TicketStatus)) {
    errors.status = "Invalid status.";
    return "OPEN";
  }
  return raw as TicketStatus;
}

/** Look up the currently active tenant on a unit, if any. */
async function inferTenantFromUnit(unitId: string): Promise<string | null> {
  const active = await prisma.lease.findFirst({
    where: { unitId, status: "ACTIVE" },
    select: { tenantId: true },
  });
  return active?.tenantId ?? null;
}

export async function createTicket(
  _prev: TicketFormState,
  formData: FormData
): Promise<TicketFormState> {
  const errors: FieldErrors = {};
  const unitId = requireString(errors, "unitId", formData.get("unitId"));
  const rawTenant = (formData.get("tenantId") ?? "").toString();
  const title = requireString(errors, "title", formData.get("title"), { max: 200 });
  const description = optionalString(formData.get("description"));
  const priority = parsePriority(errors, formData.get("priority"));
  const status = parseStatus(errors, formData.get("status"));

  const values = {
    unitId,
    tenantId: rawTenant,
    title,
    description: description ?? "",
    priority,
    status,
  };

  if (Object.keys(errors).length) return { errors, values };

  // If tenant not provided, auto-fill from active lease on the unit.
  const tenantId = rawTenant || (await inferTenantFromUnit(unitId));

  const ticket = await prisma.maintenanceTicket.create({
    data: {
      unitId,
      tenantId,
      title,
      description,
      priority,
      status,
      resolvedAt: status === "RESOLVED" ? new Date() : null,
    },
  });

  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
  revalidatePath(`/properties`);
  redirect(flash(`/maintenance/${ticket.id}`, "Ticket created."));
}

export async function updateTicket(
  id: string,
  _prev: TicketFormState,
  formData: FormData
): Promise<TicketFormState> {
  const errors: FieldErrors = {};
  const unitId = requireString(errors, "unitId", formData.get("unitId"));
  const rawTenant = (formData.get("tenantId") ?? "").toString();
  const title = requireString(errors, "title", formData.get("title"), { max: 200 });
  const description = optionalString(formData.get("description"));
  const priority = parsePriority(errors, formData.get("priority"));
  const status = parseStatus(errors, formData.get("status"));

  const values = {
    unitId,
    tenantId: rawTenant,
    title,
    description: description ?? "",
    priority,
    status,
  };

  if (Object.keys(errors).length) return { errors, values };

  const prior = await prisma.maintenanceTicket.findUniqueOrThrow({ where: { id } });

  let resolvedAt: Date | null = prior.resolvedAt;
  if (status === "RESOLVED" && prior.status !== "RESOLVED") resolvedAt = new Date();
  if (status !== "RESOLVED") resolvedAt = null;

  await prisma.maintenanceTicket.update({
    where: { id },
    data: {
      unitId,
      tenantId: rawTenant || null,
      title,
      description,
      priority,
      status,
      resolvedAt,
    },
  });

  revalidatePath("/maintenance");
  revalidatePath(`/maintenance/${id}`);
  revalidatePath("/dashboard");
  redirect(flash(`/maintenance/${id}`, "Ticket updated."));
}

/** Quick status toggle. Use `inline=1` in FormData to skip redirect. */
export async function setTicketStatus(formData: FormData) {
  const id = formData.get("id")?.toString();
  const status = formData.get("status")?.toString() as TicketStatus | undefined;
  const inline = formData.get("inline")?.toString() === "1";
  if (!id || !status || !STATUSES.includes(status)) return;

  const prior = await prisma.maintenanceTicket.findUniqueOrThrow({ where: { id } });
  let resolvedAt = prior.resolvedAt;
  if (status === "RESOLVED" && prior.status !== "RESOLVED") resolvedAt = new Date();
  if (status !== "RESOLVED") resolvedAt = null;

  await prisma.maintenanceTicket.update({
    where: { id },
    data: { status, resolvedAt },
  });

  revalidatePath("/maintenance");
  revalidatePath(`/maintenance/${id}`);
  revalidatePath("/dashboard");
  if (inline) return;
  redirect(flash(`/maintenance/${id}`, `Status set to ${status.replace("_", " ").toLowerCase()}.`));
}

export async function deleteTicket(formData: FormData) {
  const id = formData.get("id")?.toString();
  if (!id) return;
  await prisma.maintenanceTicket.delete({ where: { id } });
  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
  redirect(flash("/maintenance", "Ticket deleted."));
}
