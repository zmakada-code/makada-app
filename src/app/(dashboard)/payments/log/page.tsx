import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Flash } from "@/components/Flash";
import { LogPaymentForm } from "./LogPaymentForm";

export const dynamic = "force-dynamic";

export default async function LogPaymentPage() {
  const leases = await prisma.lease.findMany({
    where: { status: "ACTIVE" },
    include: {
      tenant: { select: { fullName: true } },
      unit: {
        select: {
          label: true,
          rentAmount: true,
          property: { select: { name: true } },
        },
      },
    },
    orderBy: [{ unit: { property: { name: "asc" } } }, { unit: { label: "asc" } }],
  });

  const leaseOptions = leases.map((l) => ({
    id: l.id,
    label: `${l.tenant.fullName} — ${l.unit.property.name} · ${l.unit.label}`,
    rent: Number(l.monthlyRent),
  }));

  return (
    <div>
      <Flash />
      <PageHeader
        title="Log Payment"
        description="Record a check, cash, or other manual payment."
        action={
          <ButtonLink href="/payments" variant="secondary">
            Back to Payments
          </ButtonLink>
        }
      />
      <div className="card p-6 max-w-lg">
        <LogPaymentForm leases={leaseOptions} />
      </div>
    </div>
  );
}
