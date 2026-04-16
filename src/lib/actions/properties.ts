"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requireString,
  optionalString,
  type FieldErrors,
} from "@/lib/validation";

export type PropertyFormState = {
  errors?: FieldErrors;
  values?: { name: string; address: string; notes: string };
};

function flash(path: string, message: string, type: "success" | "error" = "success") {
  const qs = new URLSearchParams({ flash: message, flashType: type }).toString();
  return `${path}?${qs}`;
}

export async function createProperty(
  _prev: PropertyFormState,
  formData: FormData
): Promise<PropertyFormState> {
  const errors: FieldErrors = {};
  const name = requireString(errors, "name", formData.get("name"), { max: 120 });
  const address = requireString(errors, "address", formData.get("address"), { max: 300 });
  const notes = optionalString(formData.get("notes"));

  if (Object.keys(errors).length) {
    return { errors, values: { name, address, notes: notes ?? "" } };
  }

  const created = await prisma.property.create({
    data: { name, address, notes },
  });

  revalidatePath("/properties");
  revalidatePath("/dashboard");
  redirect(flash(`/properties/${created.id}`, "Property created."));
}

export async function updateProperty(
  id: string,
  _prev: PropertyFormState,
  formData: FormData
): Promise<PropertyFormState> {
  const errors: FieldErrors = {};
  const name = requireString(errors, "name", formData.get("name"), { max: 120 });
  const address = requireString(errors, "address", formData.get("address"), { max: 300 });
  const notes = optionalString(formData.get("notes"));

  if (Object.keys(errors).length) {
    return { errors, values: { name, address, notes: notes ?? "" } };
  }

  await prisma.property.update({
    where: { id },
    data: { name, address, notes },
  });

  revalidatePath("/properties");
  revalidatePath(`/properties/${id}`);
  redirect(flash(`/properties/${id}`, "Property updated."));
}

export async function deleteProperty(formData: FormData) {
  const id = formData.get("id")?.toString();
  if (!id) return;

  const unitCount = await prisma.unit.count({ where: { propertyId: id } });
  if (unitCount > 0) {
    redirect(
      flash(
        `/properties/${id}`,
        `Can't delete: this property still has ${unitCount} unit${unitCount === 1 ? "" : "s"}. Remove them first.`,
        "error"
      )
    );
  }

  await prisma.property.delete({ where: { id } });
  revalidatePath("/properties");
  revalidatePath("/dashboard");
  redirect(flash("/properties", "Property deleted."));
}
