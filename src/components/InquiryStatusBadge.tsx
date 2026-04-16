import clsx from "clsx";
import type { InquiryStatus } from "@prisma/client";

const styles: Record<InquiryStatus, string> = {
  NEW: "bg-blue-50 text-blue-700 border-blue-200",
  CONTACTED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  TOURED: "bg-amber-50 text-amber-700 border-amber-200",
  REJECTED: "bg-slate-100 text-slate-600 border-slate-200",
  CONVERTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const labels: Record<InquiryStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  TOURED: "Toured",
  REJECTED: "Rejected",
  CONVERTED: "Converted",
};

export function InquiryStatusBadge({ status }: { status: InquiryStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        styles[status]
      )}
    >
      {labels[status]}
    </span>
  );
}

export const INQUIRY_STATUS_LABELS = labels;
