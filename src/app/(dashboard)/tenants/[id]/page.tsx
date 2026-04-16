import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { DeleteButton } from "@/components/DeleteButton";
import { Flash } from "@/components/Flash";
import { LeaseStatusBadge } from "@/components/LeaseStatusBadge";
import { DocumentsSection } from "@/components/DocumentsSection";
import { TicketsSection } from "@/components/TicketsSection";
import { deleteTenant } from "@/lib/actions/tenants";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

function money(n: { toString(): string }) {
  return `$${Number(n.toString()).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export default async function TenantDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: params.id },
    include: {
      leases: {
        orderBy: [{ status: "asc" }, { startDate: "desc" }],
        include: {
          unit: { include: { property: { select: { id: true, name: true } } } },
        },
      },
    },
  });
  if (!tenant) notFound();

  const active = tenant.leases.find((l) => l.status === "ACTIVE");
  const history = tenant.leases.filter((l) => l.id !== active?.id);

  return (
    <div>
      <Flash />
      <PageHeader
        title={tenant.fullName}
        description="Tenant profile and lease history."
        action={
          <div className="flex items-center gap-2">
            <ButtonLink href={`/tenants/${tenant.id}/edit`} variant="secondary">
              <Pencil className="h-4 w-4" /> Edit
            </ButtonLink>
            <ButtonLink href={`/leases/new?tenantId=${tenant.id}`}>
              <Plus className="h-4 w-4" /> New lease
            </ButtonLink>
            <DeleteButton
              action={async (fd) => {
                "use server";
                fd.append("id", tenant.id);
                await deleteTenant(fd);
              }}
              confirmText={`Delete ${tenant.fullName}? Only allowed if no active lease exists.`}
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Contact</div>
          <div className="text-sm"><span className="text-slate-500">Email:</span> {tenant.email ?? "—"}</div>
          <div className="text-sm"><span className="text-slate-500">Phone:</span> {tenant.phone ?? "—"}</div>
          {tenant.turbotenantReference && (
            <div className="text-sm mt-2">
              <span className="text-slate-500">TurboTenant:</span>{" "}
              {tenant.turbotenantReference.startsWith("http") ? (
                <a
                  href={tenant.turbotenantReference}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Open ↗
                </a>
              ) : (
                <span className="font-mono text-xs">{tenant.turbotenantReference}</span>
              )}
            </div>
          )}
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Notes</div>
          <p className="text-sm whitespace-pre-wrap">{tenant.notes ?? <span className="text-slate-400">No notes.</span>}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Active lease</h2>
      </div>
      {active ? (
        <div className="card p-5 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-medium">
                <Link
                  href={`/properties/${active.unit.property.id}`}
                  className="hover:underline"
                >
                  {active.unit.property.name}
                </Link>{" "}
                · Unit {active.unit.label}
              </div>
              <div className="text-sm text-slate-600 mt-1">
                {formatDate(active.startDate)} → {formatDate(active.endDate)} ·{" "}
                {money(active.monthlyRent)}/mo
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LeaseStatusBadge status={active.status} />
              <Link
                href={`/leases/${active.id}/edit`}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                Edit
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-5 mb-6 text-sm text-slate-500">No active lease.</div>
      )}

      {history.length > 0 && (
        <>
          <h2 className="text-sm font-semibold mb-3">Lease history</h2>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2">Property · Unit</th>
                  <th className="text-left px-4 py-2">Dates</th>
                  <th className="text-left px-4 py-2">Rent</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-right px-4 py-2">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {history.map((l) => (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <Link
                        href={`/properties/${l.unit.property.id}`}
                        className="hover:underline"
                      >
                        {l.unit.property.name}
                      </Link>{" "}
                      · {l.unit.label}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(l.startDate)} → {formatDate(l.endDate)}
                    </td>
                    <td className="px-4 py-3">{money(l.monthlyRent)}</td>
                    <td className="px-4 py-3"><LeaseStatusBadge status={l.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/leases/${l.id}/edit`}
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
        </>
      )}

      <TicketsSection by={{ tenantId: tenant.id }} />
      <DocumentsSection entityType="TENANT" entityId={tenant.id} />
    </div>
  );
}
