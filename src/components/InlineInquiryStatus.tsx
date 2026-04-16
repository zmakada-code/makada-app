"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { InquiryStatus } from "@prisma/client";
import clsx from "clsx";

const OPTIONS: { value: InquiryStatus; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "TOURED", label: "Toured" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CONVERTED", label: "Converted" },
];

const styles: Record<InquiryStatus, string> = {
  NEW: "bg-blue-50 text-blue-700 border-blue-200",
  CONTACTED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  TOURED: "bg-amber-50 text-amber-700 border-amber-200",
  REJECTED: "bg-slate-100 text-slate-600 border-slate-200",
  CONVERTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function InlineInquiryStatus({
  id,
  status,
  action,
}: {
  id: string;
  status: InquiryStatus;
  action: (formData: FormData) => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={(fd) => start(async () => {
      await action(fd);
      router.refresh();
    })}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="inline" value="1" />
      <select
        name="status"
        defaultValue={status}
        disabled={pending}
        onChange={() => formRef.current?.requestSubmit()}
        className={clsx(
          "rounded-full border px-2 py-0.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60",
          styles[status]
        )}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </form>
  );
}
