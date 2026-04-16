import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { LeaseForm } from "@/components/LeaseForm";
import { Flash } from "@/components/Flash";
import { DeleteButton } from "@/components/DeleteButton";
import { Button } from "@/components/ui/Button";
import { DocumentsSection } from "@/components/DocumentsSection";
import {
  updateLease,
  endLease,
  deleteLease,
  type LeaseFormState,
} from "@/lib/actions/leases";
import { toDateInputValue } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function EditLeasePage({
  params,
}: {
  params: { id: string };
}) {
  const lease = await prisma.lease.findUnique({
    where: { id: params.id },
    include: {
      tenant: { select: { id: true, fullName: true } },
      unit: {
        select: {
          id: true,
          label: true,
          property: { select: { name: true } },
        },
      },
    },
  });
  if (!lease) notFound();

  const [tenants, units] = await Promise.all([
    prisma.tenant.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    prisma.unit.findMany({
      orderBy: [{ property: { name: "asc" } }, { label: "asc" }],
      select: { id: true, label: true, property: { select: { name: true } } },
    }),
  ]);

  async function action(prev: LeaseFormState, formData: FormData) {
    "use server";
    return updateLease(params.id, prev, formData);
  }

  return (
    <div>
      <Flash />
      <PageHeader
        title="Edit lease"
        description={`${lease.tenant.fullName} · ${lease.unit.property.name} · ${lease.unit.label}`}
        action={
          <div className="flex items-center gap-2">
            {lease.status === "ACTIVE" && (
              <form
                action={async (fd) => {
                  "use server";
                  fd.append("id", lease.id);
                  await endLease(fd);
                }}
              >
                <Button type="submit" variant="secondary">End lease</Button>
              </form>
            )}
            <DeleteButton
              action={async (fd) => {
                "use server";
                fd.append("id", lease.id);
                await deleteLease(fd);
              }}
              confirmText="Delete this lease? If it's active, the unit will go back to vacant."
            />
          </div>
        }
      />
      <LeaseForm
        action={action}
        initial={{
          tenantId: lease.tenantId,
          unitId: lease.unitId,
          startDate: toDateInputValue(lease.startDate),
          endDate: toDateInputValue(lease.endDate),
          monthlyRent: lease.monthlyRent.toString(),
          status: lease.status,
          notes: lease.notes,
        }}
        tenants={tenants.map((t) => ({ value: t.id, label: t.fullName }))}
        units={units.map((u) => ({
          value: u.id,
          label: `${u.property.name} · ${u.label}`,
        }))}
        submitLabel="Save changes"
        cancelHref="/leases"
      />

      <DocumentsSection entityType="LEASE" entityId={lease.id} />
    </div>
  );
}
