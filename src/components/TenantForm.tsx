"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import type { TenantFormState } from "@/lib/actions/tenants";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </Button>
  );
}

export function TenantForm({
  action,
  initial,
  submitLabel,
  cancelHref,
}: {
  action: (prev: TenantFormState, formData: FormData) => Promise<TenantFormState>;
  initial?: {
    fullName?: string;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
    turbotenantReference?: string | null;
  };
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useFormState<TenantFormState, FormData>(action, {});
  const values = state.values ?? {
    fullName: initial?.fullName ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    notes: initial?.notes ?? "",
    turbotenantReference: initial?.turbotenantReference ?? "",
  };
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="card p-6 max-w-2xl space-y-4">
      <Field label="Full name" error={errors.fullName}>
        <Input name="fullName" defaultValue={values.fullName} />
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Phone" error={errors.phone}>
          <Input name="phone" defaultValue={values.phone ?? ""} placeholder="(555) 123-4567" />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input name="email" type="email" defaultValue={values.email ?? ""} />
        </Field>
      </div>
      <Field
        label="TurboTenant reference"
        hint="Link or external ID. Payments are still tracked in TurboTenant."
        error={errors.turbotenantReference}
      >
        <Input
          name="turbotenantReference"
          defaultValue={values.turbotenantReference ?? ""}
          placeholder="https://turbotenant.com/… or tenant ID"
        />
      </Field>
      <Field label="Notes" error={errors.notes}>
        <Textarea name="notes" defaultValue={values.notes ?? ""} />
      </Field>
      <div className="flex items-center gap-2 pt-2">
        <Submit label={submitLabel} />
        <ButtonLink href={cancelHref} variant="secondary">Cancel</ButtonLink>
      </div>
    </form>
  );
}
