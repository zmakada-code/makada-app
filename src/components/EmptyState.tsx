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
      <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-indigo-400" />
      </div>
      <div className="text-base font-medium">{title}</div>
      {description && (
        <p className="text-sm text-slate-500 mt-1 max-w-md">{description}</p>
      )}
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm transition-colors"
        >
          {actionLabel}
        </Link>
      )}
      {hint && <p className="text-xs text-slate-400 mt-4">{hint}</p>}
    </div>
  );
}
