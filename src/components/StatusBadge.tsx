import clsx from "clsx";
import type { OccupancyStatus } from "@prisma/client";

const styles: Record<OccupancyStatus, string> = {
  OCCUPIED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  VACANT: "bg-amber-50 text-amber-700 border-amber-200",
  TURNOVER: "bg-slate-100 text-slate-700 border-slate-200",
};

const labels: Record<OccupancyStatus, string> = {
  OCCUPIED: "Occupied",
  VACANT: "Vacant",
  TURNOVER: "Turnover",
};

export function StatusBadge({ status }: { status: OccupancyStatus }) {
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
