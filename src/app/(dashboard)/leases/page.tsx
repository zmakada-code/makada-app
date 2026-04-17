import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import clsx from "clsx";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { LeaseStatusBadge } from "@/components/LeaseStatusBadge";
import { Flash } from "@/components/Flash";
import { formatDate, daysUntil } from "@/lib/dates";
import type { LeaseStatus, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type Filter = "all" | LeaseStatus | "ending_soon";

const FILTERS: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "ACTIVE" },
  { label: "Ending soon", value: "ending_soon" },
  { label: "Upcoming", value: "UPCOMING" },
  { label: "Ended", value: "ENDED" },
  { label: "Terminated", value: "TERMINATED" },
];

function money(n: { toString(): string }) {
  return `$${Number(n.toString()).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export default async function LeasesPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const filter: Filter =
    (FILTERS.find((f) => f.value === searchParams.status)?.value as Filter) ?? "all";

  let where: Prisma.LeaseWhereInput = {};
  if (filter === "ending_soon") {
    const now = new Date();
    const in60 = new Date();
    in60.setDate(in60.getDate() + 60);
    where = { status: "ACTIVE", endDate: { gte: now, lte: in60 } };
  } else if (filter !== "all") {
    where = { status: filter };
  }

  const leases = await prisma.lease.findMany({
    where,
    orderBy: [{ status: "asc" }, { endDate: "asc" }],
    include: {
      tenant: { select: { id: true, fullName: true } },
      unit: {
        select: {
          id: true,
          label: true,
          property: { select: { id: true, name: true } },
        },
      },
    },
  });

  return (
    <div>
      <Flash />
      <PageHeader
        title="Leases"
        description="Active, upcoming, and ended leases."
        action={
          <ButtonLink href="/leases/new">
            <Plus className="h-4 w-4" /> New lease
          </ButtonLink>
        }
      />

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          const href = f.value === "all" ? "/leases" : `/leases?status=${f.value}`;
          return (
            <Link
              key={f.value}
              href={href}
              className={clsx(
                "rounded-full border px-3 py-1 text-xs font-medium transition",
                active
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {leases.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={filter === "all" ? "No leases yet" : "Nothing in this filter"}
          description={
            filter === "all"
              ? "Leases link a tenant to a unit and drive occupancy across the portfolio."
              : "No leases match this status. Try a different filter."
          }
          actionLabel={filter === "all" ? "Create a lease" : undefined}
          actionHref={filter === "all" ? "/leases/new" : undefined}
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-2">Tenant</th>
                <th className="text-left px-4 py-2">Property · Unit</th>
                <th className="text-left px-4 py-2">Dates</th>
                <th className="text-left px-4 py-2">Rent</th>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {leases.map((l) => {
                const days = daysUntil(l.endDate);
                const soon = l.status === "ACTIVE" && days >= 0 && days <= 60;
                return (
                  <tr key={l.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/tenants/${l.tenant.id}`} className="hover:underline">
                        {l.tenant.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <Link
                        href={`/properties/${l.unit.property.id}`}
                        className="hover:underline"
                      >
                        {l.unit.property.name}
                      </Link>{" "}
                      · {l.unit.label}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{formatDate(l.startDate)} → {formatDate(l.endDate)}</div>
                      {soon && (
                        <div className="text-xs text-amber-700 mt-0.5">
                          {days === 0 ? "Ends today" : `Ends in ${days} day${days === 1 ? "" : "s"}`}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">{money(l.monthlyRent)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {(l as any).leaseType === "MONTH_TO_MONTH" ? "Month-to-Month" : "Year-to-Year"}
                    </td>
                    <td className="px-4 py-3"><LeaseStatusBadge status={l.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/leases/generate?leaseId=${l.id}`}
                          className="text-sm text-indigo-600 hover:text-indigo-700"
                          title="Generate lease document"
                        >
                          Generate
                        </Link>
                        <Link
                          href={`/leases/${l.id}/edit`}
                          className="text-sm text-slate-600 hover:text-slate-900"
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
