"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import type { DocumentType, LinkedEntityType } from "@prisma/client";
import { createSupabaseAdminClient, DOCUMENTS_BUCKET } from "@/lib/supabase/admin";
import {
  requireString,
  type FieldErrors,
} from "@/lib/validation";

const DOC_TYPES: DocumentType[] = ["LEASE", "NOTICE", "RECEIPT", "RULES", "OTHER"];
const ENTITY_TYPES: LinkedEntityType[] = ["PROPERTY", "UNIT", "TENANT", "LEASE"];
const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export type DocumentFormState = {
  errors?: FieldErrors;
  values?: {
    type: string;
    linkedEntityType: string;
    linkedEntityId: string;
  };
};

function flash(path: string, message: string, type: "success" | "error" = "success") {
  const qs = new URLSearchParams({ flash: message, flashType: type }).toString();
  return `${path}?${qs}`;
}

function parseDocType(errors: FieldErrors, v: FormDataEntryValue | null): DocumentType {
  const raw = (v ?? "").toString();
  if (!DOC_TYPES.includes(raw as DocumentType)) {
    errors.type = "Invalid type.";
    return "OTHER";
  }
  return raw as DocumentType;
}

function parseEntityType(errors: FieldErrors, v: FormDataEntryValue | null): LinkedEntityType {
  const raw = (v ?? "").toString();
  if (!ENTITY_TYPES.includes(raw as LinkedEntityType)) {
    errors.linkedEntityType = "Invalid linked record type.";
    return "PROPERTY";
  }
  return raw as LinkedEntityType;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

function revalidateLinked(type: LinkedEntityType, id: string) {
  if (type === "PROPERTY") revalidatePath(`/properties/${id}`);
  if (type === "UNIT") revalidatePath(`/units/${id}/edit`);
  if (type === "TENANT") revalidatePath(`/tenants/${id}`);
  if (type === "LEASE") revalidatePath(`/leases/${id}/edit`);
}

export async function createDocument(
  _prev: DocumentFormState,
  formData: FormData
): Promise<DocumentFormState> {
  const errors: FieldErrors = {};
  const type = parseDocType(errors, formData.get("type"));
  const linkedEntityType = parseEntityType(errors, formData.get("linkedEntityType"));
  const linkedEntityId = requireString(
    errors,
    "linkedEntityId",
    formData.get("linkedEntityId")
  );

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    errors.file = "Choose a file.";
  } else {
    if (file.size > MAX_BYTES) errors.file = "File must be 10 MB or smaller.";
    else if (!ALLOWED_MIME.includes(file.type)) errors.file = "Only PDF, JPG, or PNG.";
  }

  const values = { type, linkedEntityType, linkedEntityId };
  if (Object.keys(errors).length || !(file instanceof File)) {
    return { errors, values };
  }

  // Upload to Supabase Storage
  const supabase = createSupabaseAdminClient();
  const safeName = sanitizeFilename(file.name);
  const storagePath = `${linkedEntityType.toLowerCase()}/${linkedEntityId}/${randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return {
      errors: { file: `Upload failed: ${uploadError.message}` },
      values,
    };
  }

  const doc = await prisma.document.create({
    data: {
      filename: file.name,
      fileUrl: "",
      storagePath,
      type,
      linkedEntityType,
      linkedEntityId,
    },
  });

  revalidatePath("/documents");
  revalidatePath("/dashboard");
  revalidateLinked(linkedEntityType, linkedEntityId);
  redirect(flash(`/documents/${doc.id}`, "Document uploaded."));
}

export async function updateDocumentMetadata(
  id: string,
  _prev: DocumentFormState,
  formData: FormData
): Promise<DocumentFormState> {
  const errors: FieldErrors = {};
  const type = parseDocType(errors, formData.get("type"));
  const linkedEntityType = parseEntityType(errors, formData.get("linkedEntityType"));
  const linkedEntityId = requireString(
    errors,
    "linkedEntityId",
    formData.get("linkedEntityId")
  );

  const values = { type, linkedEntityType, linkedEntityId };
  if (Object.keys(errors).length) return { errors, values };

  await prisma.document.update({
    where: { id },
    data: { type, linkedEntityType, linkedEntityId },
  });

  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
  revalidateLinked(linkedEntityType, linkedEntityId);
  redirect(flash(`/documents/${id}`, "Document updated."));
}

export async function deleteDocument(formData: FormData) {
  const id = formData.get("id")?.toString();
  if (!id) return;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return;

  const supabase = createSupabaseAdminClient();
  await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.storagePath]);
  await prisma.document.delete({ where: { id } });

  revalidatePath("/documents");
  revalidatePath("/dashboard");
  revalidateLinked(doc.linkedEntityType, doc.linkedEntityId);
  redirect(flash("/documents", "Document deleted."));
}
