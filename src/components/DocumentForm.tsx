"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { LinkedEntityType } from "@prisma/client";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import type { DocumentFormState } from "@/lib/actions/documents";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Uploading..." : label}
    </Button>
  );
}

export type LinkedOption = { value: string; label: string };

export type LinkedOptions = {
  PROPERTY: LinkedOption[];
  UNIT: LinkedOption[];
  TENANT: LinkedOption[];
  LEASE: LinkedOption[];
};

type Initial = {
  type?: "LEASE" | "NOTICE" | "RECEIPT" | "RULES" | "OTHER";
  linkedEntityType?: LinkedEntityType;
  linkedEntityId?: string;
};

export function DocumentForm({
  action,
  initial,
  linkedOptions,
  mode,
  submitLabel,
  cancelHref,
}: {
  action: (prev: DocumentFormState, formData: FormData) => Promise<DocumentFormState>;
  initial?: Initial;
  linkedOptions: LinkedOptions;
  mode: "upload" | "edit";
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useFormState<DocumentFormState, FormData>(action, {});
  const values = state.values ?? {
    type: initial?.type ?? "OTHER",
    linkedEntityType: initial?.linkedEntityType ?? "PROPERTY",
    linkedEntityId: initial?.linkedEntityId ?? "",
  };
  const errors = state.errors ?? {};

  const [entityType, setEntityType] = useState<LinkedEntityType>(
    (values.linkedEntityType as LinkedEntityType) ?? "PROPERTY"
  );
  const entityOptions = linkedOptions[entityType] ?? [];

  return (
    <form action={formAction} className="card p-6 max-w-2xl space-y-4">
      {mode === "upload" && (
        <Field
          label="File"
          hint="PDF, JPG, or PNG. Max 10 MB."
          error={errors.file}
        >
          <Input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*" />
        </Field>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Document type" error={errors.type}>
          <Select name="type" defaultValue={values.type}>
            <option value="LEASE">Lease</option>
            <option value="NOTICE">Notice</option>
            <option value="RECEIPT">Receipt</option>
            <option value="RULES">House rules</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field label="Linked record type" error={errors.linkedEntityType}>
          <Select
            name="linkedEntityType"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as LinkedEntityType)}
          >
            <option value="PROPERTY">Property</option>
            <option value="UNIT">Unit</option>
            <option value="TENANT">Tenant</option>
            <option value="LEASE">Lease</option>
          </Select>
        </Field>
      </div>

      <Field label="Linked record" error={errors.linkedEntityId}>
        <Select
          name="linkedEntityId"
          defaultValue={values.linkedEntityId}
          key={entityType /* reset on type change */}
        >
          <option value="">Select a {entityType.toLowerCase()}…</option>
          {entityOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </Field>

      <div className="flex items-center gap-2 pt-2">
        <Submit label={submitLabel} />
        <ButtonLink href={cancelHref} variant="secondary">Cancel</ButtonLink>
      </div>
    </form>
  );
}
