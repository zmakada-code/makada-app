import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { MaintenanceForm } from "@/components/MaintenanceForm";
import { createTicket } from "@/lib/actions/maintenance";

export const dynamic = "force-dynamic";

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: { unitId?: string; tenantId?: string };
}) {
  const [units, tenants] = await Promise.all([
    prisma.unit.findMany({
      orderBy: [{ property: { name: "asc" } }, { label: "asc" }],
      select: { id: true, label: true, property: { select: { name: true } } },
    }),
    prisma.tenant.findMany({
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
  ]);

  return (
    <div>
      <PageHeader title="New maintenance ticket" description="Log an issue against a unit." />
      <MaintenanceForm
        action={createTicket}
        initial={{
          unitId: searchParams.unitId,
          tenantId: searchParams.tenantId,
          priority: "MEDIUM",
          status: "OPEN",
        }}
        units={units.map((u) => ({
          value: u.id,
          label: `${u.property.name} · ${u.label}`,
        }))}
        tenants={tenants.map((t) => ({ value: t.id, label: t.fullName }))}
        submitLabel="Create ticket"
        cancelHref="/maintenance"
      />
    </div>
  );
}
