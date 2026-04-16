import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { LeaseForm } from "@/components/LeaseForm";
import { createLease } from "@/lib/actions/leases";

export const dynamic = "force-dynamic";

export default async function NewLeasePage({
  searchParams,
}: {
  searchParams: { tenantId?: string; unitId?: string };
}) {
  const [tenants, units] = await Promise.all([
    prisma.tenant.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    prisma.unit.findMany({
      orderBy: [{ property: { name: "asc" } }, { label: "asc" }],
      select: {
        id: true,
        label: true,
        rentAmount: true,
        property: { select: { name: true } },
      },
    }),
  ]);

  if (tenants.length === 0 || units.length === 0) {
    return (
      <div>
        <PageHeader title="New lease" />
        <div className="card p-8 text-sm text-slate-600">
          You need at least one{" "}
          {tenants.length === 0 && (
            <Link href="/tenants/new" className="text-blue-600 hover:underline">
              tenant
            </Link>
          )}
          {tenants.length === 0 && units.length === 0 && " and one "}
          {units.length === 0 && (
            <Link href="/properties" className="text-blue-600 hover:underline">
              unit
            </Link>
          )}{" "}
          before you can create a lease.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="New lease" description="Link a tenant to a unit." />
      <LeaseForm
        action={createLease}
        initial={{
          tenantId: searchParams.tenantId,
          unitId: searchParams.unitId,
          status: "UPCOMING",
        }}
        tenants={tenants.map((t) => ({ value: t.id, label: t.fullName }))}
        units={units.map((u) => ({
          value: u.id,
          label: `${u.property.name} · ${u.label}`,
        }))}
        submitLabel="Create lease"
        cancelHref="/leases"
      />
    </div>
  );
}
