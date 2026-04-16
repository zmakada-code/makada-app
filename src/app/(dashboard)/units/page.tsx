import Link from "next/link";
import { DoorOpen } from "lucide-react";
import clsx from "clsx";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Flash } from "@/components/Flash";
import type { OccupancyStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const FILTERS: { label: string; value: "all" | OccupancyStatus }[] = [
  { label: "All", value: "all" },
  { label: "Occupied", value: "OCCUPIED" },
  { label: "Vacant", value: "VACANT" },
  { label: "Turnover", value: "TURNOVER" },
];

function money(n: { toString(): string }) {
  const num = Number(n.toString());
  return `$${num.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export default async function UnitsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const filter = FILTERS.find((f) => f.value === searchParams.status)?.value ?? "all";
  const where = filter === "all" ? {} : { occupancyStatus: filter as OccupancyStatus };

  const units = await prisma.unit.findMany({
    where,
    orderBy: [{ property: { name: "asc" } }, { label: "asc" }],
    include: { property: { select: { id: true, name: true } } },
  });

  return (
    <div>
      <Flash />
      <PageHeader
        title="Units"
        description="All rental units across every property."
      />

      <div className="flex items-center gap-2 mb-4">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          const href = f.value === "all" ? "/units" : `/units?status=${f.value}`;
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

      {units.length === 0 ? (
        <EmptyState
          icon={DoorOpen}
          title={filter === "all" ? "No units yet" : "Nothing in this filter"}
          description={
            filter === "all"
              ? "Units live under properties. Add a property first, then add units to it."
              : "No units match this status. Try a different filter."
          }
          actionLabel={filter === "all" ? "Add a property" : undefined}
          actionHref={filter === "all" ? "/properties/new" : undefined}
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-2">Property</th>
                <th className="text-left px-4 py-2">Unit</th>
                <th className="text-left px-4 py-2">Beds / Baths</th>
                <th className="text-left px-4 py-2">Rent</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/properties/${u.property.id}`}
                      className="text-slate-700 hover:text-slate-900"
                    >
                      {u.property.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium">{u.label}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {u.bedrooms} bd / {u.bathrooms} ba
                  </td>
                  <td className="px-4 py-3">{money(u.rentAmount)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.occupancyStatus} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/units/${u.id}/edit`}
                      className="text-sm text-slate-600 hover:text-slate-900"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
