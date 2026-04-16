import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { ButtonLink, Button } from "@/components/ui/Button";
import { Flash } from "@/components/Flash";
import { TicketStatusBadge } from "@/components/TicketStatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { DeleteButton } from "@/components/DeleteButton";
import { DocumentsSection } from "@/components/DocumentsSection";
import { formatDate } from "@/lib/dates";
import { setTicketStatus, deleteTicket } from "@/lib/actions/maintenance";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const ticket = await prisma.maintenanceTicket.findUnique({
    where: { id: params.id },
    include: {
      unit: {
        include: { property: { select: { id: true, name: true } } },
      },
      tenant: { select: { id: true, fullName: true } },
    },
  });
  if (!ticket) notFound();

  return (
    <div>
      <Flash />
      <PageHeader
        title={ticket.title}
        description={`${ticket.unit.property.name} · Unit ${ticket.unit.label}`}
        action={
          <div className="flex items-center gap-2">
            <ButtonLink href={`/maintenance/${ticket.id}/edit`} variant="secondary">
              <Pencil className="h-4 w-4" /> Edit
            </ButtonLink>
            <DeleteButton
              action={async (fd) => {
                "use server";
                fd.append("id", ticket.id);
                await deleteTicket(fd);
              }}
              confirmText="Delete this ticket? This cannot be undone."
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Status</div>
          <div className="flex items-center gap-2 mb-3">
            <TicketStatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["OPEN", "IN_PROGRESS", "RESOLVED"] as const)
              .filter((s) => s !== ticket.status)
              .map((s) => (
                <form
                  key={s}
                  action={async (fd) => {
                    "use server";
                    fd.append("id", ticket.id);
                    fd.append("status", s);
                    await setTicketStatus(fd);
                  }}
                >
                  <Button type="submit" variant="secondary">
                    Mark {s.replace("_", " ").toLowerCase()}
                  </Button>
                </form>
              ))}
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Related</div>
          <div className="text-sm">
            <span className="text-slate-500">Unit:</span>{" "}
            <Link
              href={`/properties/${ticket.unit.property.id}`}
              className="hover:underline"
            >
              {ticket.unit.property.name} · {ticket.unit.label}
            </Link>
          </div>
          <div className="text-sm mt-1">
            <span className="text-slate-500">Tenant:</span>{" "}
            {ticket.tenant ? (
              <Link href={`/tenants/${ticket.tenant.id}`} className="hover:underline">
                {ticket.tenant.fullName}
              </Link>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Timeline</div>
          <div className="text-sm"><span className="text-slate-500">Created:</span> {formatDate(ticket.createdAt)}</div>
          <div className="text-sm"><span className="text-slate-500">Updated:</span> {formatDate(ticket.updatedAt)}</div>
          <div className="text-sm"><span className="text-slate-500">Resolved:</span> {ticket.resolvedAt ? formatDate(ticket.resolvedAt) : "—"}</div>
        </div>
      </div>

      <div className="card p-5">
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Description</div>
        <p className="text-sm whitespace-pre-wrap">
          {ticket.description ?? <span className="text-slate-400">No description.</span>}
        </p>
      </div>

      <DocumentsSection entityType="UNIT" entityId={ticket.unitId} />
    </div>
  );
}
