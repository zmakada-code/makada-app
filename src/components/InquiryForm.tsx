"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import type { InquiryFormState } from "@/lib/actions/inquiries";
import type { InquirySource, InquiryStatus } from "@prisma/client";

export type UnitOption = {
  value: string;
  label: string;
  vacant: boolean;
};

const SOURCE_OPTIONS: { value: InquirySource; label: string }[] = [
  { value: "WEBSITE", label: "Website" },
  { value: "WALK_IN", label: "Walk-in" },
  { value: "REFERRAL", label: "Referral" },
  { value: "OTHER", label: "Other" },
];

const STATUS_OPTIONS: { value: InquiryStatus; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "TOURED", label: "Toured" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CONVERTED", label: "Converted" },
];

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </Button>
  );
}

export function InquiryForm({
  action,
  initial,
  units,
  submitLabel,
  cancelHref,
}: {
  action: (prev: InquiryFormState, formData: FormData) => Promise<InquiryFormState>;
  initial?: {
    prospectName?: string;
    phone?: string | null;
    email?: string | null;
    message?: string | null;
    unitId?: string | null;
    source?: InquirySource;
    status?: InquiryStatus;
  };
  units: UnitOption[];
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useFormState<InquiryFormState, FormData>(action, {});
  const values = state.values ?? {
    prospectName: initial?.prospectName ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    message: initial?.message ?? "",
    unitId: initial?.unitId ?? "",
    source: (initial?.source ?? "WEBSITE") as InquirySource,
    status: (initial?.status ?? "NEW") as InquiryStatus,
  };
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="card p-6 max-w-2xl space-y-4">
      <Field label="Prospect name" error={errors.prospectName}>
        <Input name="prospectName" defaultValue={values.prospectName} />
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
        label="Interested in (unit)"
        hint="Optional. Vacant units are marked."
        error={errors.unitId}
      >
        <Select name="unitId" defaultValue={values.unitId ?? ""}>
          <option value="">— No unit —</option>
          {units.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
              {u.vacant ? " · vacant" : ""}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Source" error={errors.source}>
          <Select name="source" defaultValue={values.source}>
            {SOURCE_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" error={errors.status}>
          <Select name="status" defaultValue={values.status}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Message" error={errors.message}>
        <Textarea name="message" rows={4} defaultValue={values.message ?? ""} />
      </Field>
      <div className="flex items-center gap-2 pt-2">
        <Submit label={submitLabel} />
        <ButtonLink href={cancelHref} variant="secondary">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
