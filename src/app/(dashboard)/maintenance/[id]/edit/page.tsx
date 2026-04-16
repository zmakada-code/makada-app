import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { MaintenanceForm } from "@/components/MaintenanceForm";
import { updateTicket, type TicketFormState } from "@/lib/actions/maintenance";

export const dynamic = "force-dynamic";

export default async function EditTicketPage({
  params,
}: {
  params: { id: string };
}) {
  const ticket = await prisma.maintenanceTicket.findUnique({
    where: { id: params.id },
  });
  if (!ticket) notFound();

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

  async function action(prev: TicketFormState, formData: FormData) {
    "use server";
    return updateTicket(params.id, prev, formData);
  }

  return (
    <div>
      <PageHeader title="Edit ticket" description={ticket.title} />
      <MaintenanceForm
        action={action}
        initial={{
          unitId: ticket.unitId,
          tenantId: ticket.tenantId,
          title: ticket.title,
          description: ticket.description,
          priority: ticket.priority,
          status: ticket.status,
        }}
        units={units.map((u) => ({
          value: u.id,
          label: `${u.property.name} · ${u.label}`,
        }))}
        tenants={tenants.map((t) => ({ value: t.id, label: t.fullName }))}
        submitLabel="Save changes"
        cancelHref={`/maintenance/${ticket.id}`}
      />
    </div>
  );
}
