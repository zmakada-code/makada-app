import clsx from "clsx";
import type { LeaseStatus } from "@prisma/client";

const styles: Record<LeaseStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  UPCOMING: "bg-blue-50 text-blue-700 border-blue-200",
  ENDED: "bg-slate-100 text-slate-700 border-slate-200",
  TERMINATED: "bg-red-50 text-red-700 border-red-200",
};

const labels: Record<LeaseStatus, string> = {
  ACTIVE: "Active",
  UPCOMING: "Upcoming",
  ENDED: "Ended",
  TERMINATED: "Terminated",
};

export function LeaseStatusBadge({ status }: { status: LeaseStatus }) {
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
