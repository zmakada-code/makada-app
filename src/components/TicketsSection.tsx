import Link from "next/link";
import { Wrench, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ButtonLink } from "@/components/ui/Button";
import { TicketStatusBadge } from "@/components/TicketStatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { formatDate } from "@/lib/dates";

export async function TicketsSection({
  by,
}: {
  by: { unitId: string } | { tenantId: string } | { propertyId: string };
}) {
  const where =
    "unitId" in by
      ? { unitId: by.unitId }
      : "tenantId" in by
      ? { tenantId: by.tenantId }
      : { unit: { propertyId: by.propertyId } };

  const tickets = await prisma.maintenanceTicket.findMany({
    where,
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 10,
    include: { unit: { select: { label: true } } },
  });

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Wrench className="h-4 w-4 text-slate-500" /> Maintenance ({tickets.length})
        </h2>
        <ButtonLink href="/maintenance/new" variant="secondary">
          <Plus className="h-4 w-4" /> New ticket
        </ButtonLink>
      </div>
      {tickets.length === 0 ? (
        <div className="card p-5 text-sm text-slate-500">No tickets yet.</div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/maintenance/${t.id}`}
              className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-slate-50"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{t.title}</div>
                <div className="text-xs text-slate-500">
                  Unit {t.unit.label} · updated {formatDate(t.updatedAt)}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <PriorityBadge priority={t.priority} />
                <TicketStatusBadge status={t.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
