import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { Flash } from "@/components/Flash";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  const tenants = await prisma.tenant.findMany({
    orderBy: { fullName: "asc" },
    include: {
      leases: {
        where: { status: "ACTIVE" },
        include: { unit: { include: { property: { select: { name: true } } } } },
        take: 1,
      },
    },
  });

  return (
    <div>
      <Flash />
      <PageHeader
        title="Tenants"
        description="Tenant directory and current assignments."
        action={
          <ButtonLink href="/tenants/new">
            <Plus className="h-4 w-4" /> Add tenant
          </ButtonLink>
        }
      />

      {tenants.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No tenants yet"
          description="Add your first tenant to start tracking leases, documents, and maintenance."
          actionLabel="Add your first tenant"
          actionHref="/tenants/new"
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-2">Tenant</th>
                <th className="text-left px-4 py-2">Contact</th>
                <th className="text-left px-4 py-2">Current unit</th>
                <th className="text-left px-4 py-2">Lease ends</th>
                <th className="text-right px-4 py-2">&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => {
                const active = t.leases[0];
                return (
                  <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/tenants/${t.id}`} className="hover:underline">
                        {t.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{t.email ?? "—"}</div>
                      <div className="text-xs text-slate-500">{t.phone ?? ""}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {active ? (
                        <Link
                          href={`/properties/${active.unit.propertyId}`}
                          className="hover:text-slate-900"
                        >
                          {active.unit.property.name} · {active.unit.label}
                        </Link>
                      ) : (
                        <span className="text-slate-400">No active lease</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {active ? formatDate(active.endDate) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/tenants/${t.id}`}
                        className="text-sm text-slate-600 hover:text-slate-900"
                      >
                        View
                      </Link>
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
