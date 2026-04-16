import Link from "next/link";
import { Wrench, Plus } from "lucide-react";
import clsx from "clsx";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { Flash } from "@/components/Flash";
import { PriorityBadge } from "@/components/PriorityBadge";
import { InlineTicketStatus } from "@/components/InlineTicketStatus";
import { setTicketStatus } from "@/lib/actions/maintenance";
import { formatDate } from "@/lib/dates";
import type { TicketStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const FILTERS: { label: string; value: "all" | TicketStatus }[] = [
  { label: "All", value: "all" },
  { label: "Open", value: "OPEN" },
  { label: "In progress", value: "IN_PROGRESS" },
  { label: "Resolved", value: "RESOLVED" },
];

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const filter =
    FILTERS.find((f) => f.value === searchParams.status)?.value ?? "all";
  const where = filter === "all" ? {} : { status: filter as TicketStatus };

  const tickets = await prisma.maintenanceTicket.findMany({
    where,
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: {
      unit: {
        select: { label: true, property: { select: { id: true, name: true } } },
      },
      tenant: { select: { id: true, fullName: true } },
    },
  });

  return (
    <div>
      <Flash />
      <PageHeader
        title="Maintenance"
        description="Internal work queue."
        action={
          <ButtonLink href="/maintenance/new">
            <Plus className="h-4 w-4" /> New ticket
          </ButtonLink>
        }
      />

      <div className="flex items-center gap-2 mb-4">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          const href = f.value === "all" ? "/maintenance" : `/maintenance?status=${f.value}`;
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

      {tickets.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={filter === "all" ? "You're all clear" : "Nothing in this filter"}
          description={
            filter === "all"
              ? "No open work orders right now. New tickets you create will appear here."
              : "No tickets match this status. Try a different filter."
          }
          actionLabel={filter === "all" ? "Log a ticket" : undefined}
          actionHref={filter === "all" ? "/maintenance/new" : undefined}
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-2">Title</th>
                <th className="text-left px-4 py-2">Property · Unit</th>
                <th className="text-left px-4 py-2">Tenant</th>
                <th className="text-left px-4 py-2">Priority</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Updated</th>
                <th className="text-left px-4 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/maintenance/${t.id}`} className="hover:underline">
                      {t.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <Link
                      href={`/properties/${t.unit.property.id}`}
                      className="hover:underline"
                    >
                      {t.unit.property.name}
                    </Link>{" "}
                    · {t.unit.label}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {t.tenant ? (
                      <Link href={`/tenants/${t.tenant.id}`} className="hover:underline">
                        {t.tenant.fullName}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                  <td className="px-4 py-3">
                    <InlineTicketStatus
                      id={t.id}
                      status={t.status}
                      action={async (fd) => {
                        "use server";
                        await setTicketStatus(fd);
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{formatDate(t.updatedAt)}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{formatDate(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
