"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import type { UnitFormState } from "@/lib/actions/units";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </Button>
  );
}

type InitialUnit = {
  label?: string;
  bedrooms?: number;
  bathrooms?: number;
  rentAmount?: number | string;
  depositAmount?: number | string;
  occupancyStatus?: "VACANT" | "OCCUPIED" | "TURNOVER";
  notes?: string | null;
};

export function UnitForm({
  action,
  initial,
  submitLabel,
  cancelHref,
}: {
  action: (prev: UnitFormState, formData: FormData) => Promise<UnitFormState>;
  initial?: InitialUnit;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useFormState<UnitFormState, FormData>(action, {});
  const values = state.values ?? {
    label: initial?.label ?? "",
    bedrooms: String(initial?.bedrooms ?? 1),
    bathrooms: String(initial?.bathrooms ?? 1),
    rentAmount: String(initial?.rentAmount ?? ""),
    depositAmount: String(initial?.depositAmount ?? ""),
    occupancyStatus: initial?.occupancyStatus ?? "VACANT",
    notes: initial?.notes ?? "",
  };
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="card p-6 max-w-2xl space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Unit label" hint="e.g. 1A, Upstairs, Unit 3" error={errors.label}>
          <Input name="label" defaultValue={values.label} />
        </Field>
        <Field label="Occupancy status" error={errors.occupancyStatus}>
          <Select name="occupancyStatus" defaultValue={values.occupancyStatus}>
            <option value="VACANT">Vacant</option>
            <option value="OCCUPIED">Occupied</option>
            <option value="TURNOVER">Turnover</option>
          </Select>
        </Field>
        <Field label="Bedrooms" error={errors.bedrooms}>
          <Input type="number" name="bedrooms" min={0} step={1} defaultValue={values.bedrooms} />
        </Field>
        <Field label="Bathrooms" error={errors.bathrooms}>
          <Input type="number" name="bathrooms" min={0} step={0.5} defaultValue={values.bathrooms} />
        </Field>
        <Field label="Monthly rent" hint="USD" error={errors.rentAmount}>
          <Input type="number" name="rentAmount" min={0} step={1} defaultValue={values.rentAmount} />
        </Field>
        <Field label="Security deposit" hint="USD" error={errors.depositAmount}>
          <Input
            type="number"
            name="depositAmount"
            min={0}
            step={1}
            defaultValue={values.depositAmount}
          />
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
