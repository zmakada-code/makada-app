import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  hint,
  actionLabel,
  actionHref,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  hint?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="card p-10 flex flex-col items-center text-center">
      <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Icon className="h-5 w-5 text-slate-500" />
      </div>
      <div className="text-base font-medium">{title}</div>
      {description && (
        <p className="text-sm text-slate-500 mt-1 max-w-md">{description}</p>
      )}
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-5 inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {actionLabel}
        </Link>
      )}
      {hint && <p className="text-xs text-slate-400 mt-4">{hint}</p>}
    </div>
  );
}
