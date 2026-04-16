"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import type { PropertyFormState } from "@/lib/actions/properties";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </Button>
  );
}

export function PropertyForm({
  action,
  initial,
  submitLabel,
  cancelHref,
}: {
  action: (prev: PropertyFormState, formData: FormData) => Promise<PropertyFormState>;
  initial?: { name?: string; address?: string; notes?: string | null };
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useFormState<PropertyFormState, FormData>(action, {});
  const values = state.values ?? {
    name: initial?.name ?? "",
    address: initial?.address ?? "",
    notes: initial?.notes ?? "",
  };
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="card p-6 max-w-2xl space-y-4">
      <Field label="Property name" error={errors.name}>
        <Input name="name" defaultValue={values.name} placeholder="e.g. 123 Main St Duplex" />
      </Field>
      <Field label="Address" error={errors.address}>
        <Input name="address" defaultValue={values.address} placeholder="123 Main St, City, ST" />
      </Field>
      <Field label="Internal notes" hint="Only visible to family/admin." error={errors.notes}>
        <Textarea name="notes" defaultValue={values.notes ?? ""} />
      </Field>
      <div className="flex items-center gap-2 pt-2">
        <Submit label={submitLabel} />
        <ButtonLink href={cancelHref} variant="secondary">Cancel</ButtonLink>
      </div>
    </form>
  );
}
