import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { LeaseForm } from "@/components/LeaseForm";
import { Flash } from "@/components/Flash";
import { DeleteButton } from "@/components/DeleteButton";
import { Button } from "@/components/ui/Button";
import { DocumentsSection } from "@/components/DocumentsSection";
import { DepositSection } from "@/components/DepositSection";
import { FeesSection } from "@/components/FeesSection";
import {
  updateLease,
  endLease,
  deleteLease,
  type LeaseFormState,
} from "@/lib/actions/leases";
import { toDateInputValue } from "@/lib/dates";
import { calculateLateFee } from "@/lib/late-fees";

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
          depositAmount: true,
          property: { select: { name: true } },
        },
      },
      fees: { orderBy: { createdAt: "desc" } },
      paymentStatuses: {
        orderBy: { period: "desc" },
        take: 6,
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

  const depositRequired = Number(lease.depositAmount ?? lease.unit.depositAmount);

  // Calculate current late fees for unpaid periods
  const periodsWithLateFees = lease.paymentStatuses
    .filter((ps) => ps.status !== "PAID" && !ps.lateFeeWaived)
    .map((ps) => ({
      ...ps,
      calculatedLateFee: calculateLateFee({
        period: ps.period,
        rentPaidAt: null,
        lateFeePerDay: Number(lease.lateFeePerDay),
        rentDueDay: lease.rentDueDay,
        gracePeriodDays: lease.gracePeriodDays,
      }),
    }));

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
          leaseType: (lease as any).leaseType ?? "YEAR_TO_YEAR",
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

      {/* Security Deposit */}
      <DepositSection
        leaseId={lease.id}
        depositRequired={depositRequired}
        depositStatus={lease.depositStatus}
        depositPaidAmount={lease.depositPaidAmount ? Number(lease.depositPaidAmount) : null}
        depositPaidAt={lease.depositPaidAt?.toISOString() ?? null}
        depositPaymentMethod={lease.depositPaymentMethod}
        depositNote={lease.depositNote}
      />

      {/* Fees & Charges */}
      <FeesSection
        leaseId={lease.id}
        fees={lease.fees.map((f) => ({
          id: f.id,
          name: f.name,
          amount: Number(f.amount),
          isRecurring: f.isRecurring,
          paidStatus: f.paidStatus,
          paidAmount: f.paidAmount ? Number(f.paidAmount) : null,
          paidAt: f.paidAt?.toISOString() ?? null,
          paymentMethod: f.paymentMethod,
          dueDate: f.dueDate?.toISOString() ?? null,
          note: f.note,
        }))}
      />

      {/* Late Fees Summary */}
      {periodsWithLateFees.length > 0 && (
        <div className="card p-6 mt-8">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Late Fees</h2>
          <p className="text-xs text-slate-500 mb-3">
            ${Number(lease.lateFeePerDay).toFixed(0)}/day after the {lease.rentDueDay}st{lease.gracePeriodDays > 0 ? ` (${lease.gracePeriodDays}-day grace period)` : " (no grace period)"}
          </p>
          <div className="space-y-2">
            {periodsWithLateFees.map((ps) => (
              <div key={ps.id} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {new Date(parseInt(ps.period.split("-")[0]), parseInt(ps.period.split("-")[1]) - 1)
                      .toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </p>
                  <p className="text-xs text-slate-500">Rent unpaid</p>
                </div>
                <span className="text-sm font-semibold text-amber-700">
                  +${ps.calculatedLateFee.toLocaleString()} late fee
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <DocumentsSection entityType="LEASE" entityId={lease.id} />
    </div>
  );
}
