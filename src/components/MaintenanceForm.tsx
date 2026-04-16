"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import type { TicketFormState } from "@/lib/actions/maintenance";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </Button>
  );
}

export type Option = { value: string; label: string };

type Initial = {
  unitId?: string;
  tenantId?: string | null;
  title?: string;
  description?: string | null;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status?: "OPEN" | "IN_PROGRESS" | "RESOLVED";
};

export function MaintenanceForm({
  action,
  initial,
  units,
  tenants,
  submitLabel,
  cancelHref,
}: {
  action: (prev: TicketFormState, formData: FormData) => Promise<TicketFormState>;
  initial?: Initial;
  units: Option[];
  tenants: Option[];
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useFormState<TicketFormState, FormData>(action, {});
  const values = state.values ?? {
    unitId: initial?.unitId ?? "",
    tenantId: initial?.tenantId ?? "",
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    priority: initial?.priority ?? "MEDIUM",
    status: initial?.status ?? "OPEN",
  };
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="card p-6 max-w-2xl space-y-4">
      <Field label="Title" error={errors.title}>
        <Input name="title" defaultValue={values.title} placeholder="Kitchen sink leaking" />
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Unit" error={errors.unitId}>
          <Select name="unitId" defaultValue={values.unitId}>
            <option value="">Select unit…</option>
            {units.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </Select>
        </Field>
        <Field
          label="Tenant"
          hint="Optional. Leave blank to auto-fill from the active lease."
          error={errors.tenantId}
        >
          <Select name="tenantId" defaultValue={values.tenantId ?? ""}>
            <option value="">— Auto / none —</option>
            {tenants.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Priority" error={errors.priority}>
          <Select name="priority" defaultValue={values.priority}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </Select>
        </Field>
        <Field label="Status" error={errors.status}>
          <Select name="status" defaultValue={values.status}>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="RESOLVED">Resolved</option>
          </Select>
        </Field>
      </div>
      <Field label="Description" error={errors.description}>
        <Textarea name="description" defaultValue={values.description ?? ""} rows={5} />
      </Field>
      <div className="flex items-center gap-2 pt-2">
        <Submit label={submitLabel} />
        <ButtonLink href={cancelHref} variant="secondary">Cancel</ButtonLink>
      </div>
    </form>
  );
}
