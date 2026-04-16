"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import type { LeaseFormState } from "@/lib/actions/leases";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </Button>
  );
}

export type LeaseFormOption = { value: string; label: string };

type Initial = {
  tenantId?: string;
  unitId?: string;
  startDate?: string;
  endDate?: string;
  monthlyRent?: number | string;
  status?: "ACTIVE" | "UPCOMING" | "ENDED" | "TERMINATED";
  notes?: string | null;
};

export function LeaseForm({
  action,
  initial,
  tenants,
  units,
  submitLabel,
  cancelHref,
}: {
  action: (prev: LeaseFormState, formData: FormData) => Promise<LeaseFormState>;
  initial?: Initial;
  tenants: LeaseFormOption[];
  units: LeaseFormOption[];
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useFormState<LeaseFormState, FormData>(action, {});
  const values = state.values ?? {
    tenantId: initial?.tenantId ?? "",
    unitId: initial?.unitId ?? "",
    startDate: initial?.startDate ?? "",
    endDate: initial?.endDate ?? "",
    monthlyRent: String(initial?.monthlyRent ?? ""),
    status: initial?.status ?? "UPCOMING",
    notes: initial?.notes ?? "",
  };
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="card p-6 max-w-2xl space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Tenant" error={errors.tenantId}>
          <Select name="tenantId" defaultValue={values.tenantId}>
            <option value="">Select tenant…</option>
            {tenants.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Unit" error={errors.unitId}>
          <Select name="unitId" defaultValue={values.unitId}>
            <option value="">Select unit…</option>
            {units.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Start date" error={errors.startDate}>
          <Input type="date" name="startDate" defaultValue={values.startDate} />
        </Field>
        <Field label="End date" error={errors.endDate}>
          <Input type="date" name="endDate" defaultValue={values.endDate} />
        </Field>
        <Field label="Monthly rent" hint="USD" error={errors.monthlyRent}>
          <Input
            type="number"
            name="monthlyRent"
            min={0}
            step={1}
            defaultValue={values.monthlyRent}
          />
        </Field>
        <Field
          label="Status"
          hint="Setting to Active marks the unit occupied."
          error={errors.status}
        >
          <Select name="status" defaultValue={values.status}>
            <option value="UPCOMING">Upcoming</option>
            <option value="ACTIVE">Active</option>
            <option value="ENDED">Ended</option>
            <option value="TERMINATED">Terminated</option>
          </Select>
        </Field>
      </div>
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
