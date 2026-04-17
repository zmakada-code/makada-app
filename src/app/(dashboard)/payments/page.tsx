import Link from "next/link";
import { CreditCard, CheckCircle2, Clock, AlertCircle, Banknote, CreditCard as CardIcon } from "lucide-react";
import clsx from "clsx";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Flash } from "@/components/Flash";
import type { PaymentState } from "@prisma/client";

export const dynamic = "force-dynamic";

type Filter = "all" | PaymentState;

const FILTERS: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Paid", value: "PAID" },
  { label: "Behind", value: "BEHIND" },
  { label: "Unknown", value: "UNKNOWN" },
];

function StatusIcon({ status }: { status: PaymentState }) {
  switch (status) {
    case "PAID":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "BEHIND":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-slate-400" />;
  }
}

function StatusBadge({ status }: { status: PaymentState }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        status === "PAID" && "bg-emerald-50 text-emerald-700",
        status === "BEHIND" && "bg-red-50 text-red-700",
        status === "UNKNOWN" && "bg-slate-100 text-slate-600"
      )}
    >
      <StatusIcon status={status} />
      {status === "PAID" ? "Paid" : status === "BEHIND" ? "Behind" : "Unknown"}
    </span>
  );
}

function money(n: { toString(): string }) {
  return `$${Number(n.toString()).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: { status?: string; period?: string };
}) {
  const filter = (searchParams.status ?? "all") as Filter;
  const periodFilter = searchParams.period;

  // Get all distinct periods, ordered descending
  const periods = await prisma.paymentStatus.findMany({
    select: { period: true },
    distinct: ["period"],
    orderBy: { period: "desc" },
  });

  const currentPeriod = periodFilter || (periods[0]?.period ?? "");

  // Build where clause
  const where: Record<string, unknown> = {};
  if (filter !== "all") where.status = filter;
  if (currentPeriod) where.period = currentPeriod;

  const payments = await prisma.paymentStatus.findMany({
    where,
    orderBy: [{ period: "desc" }, { createdAt: "desc" }],
    include: {
      lease: {
        include: {
          tenant: { select: { id: true, fullName: true } },
          unit: {
            select: {
              label: true,
              rentAmount: true,
              property: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  // Summary counts for the selected period
  const paidCount = payments.filter((p) => p.status === "PAID").length;
  const behindCount = payments.filter((p) => p.status === "BEHIND").length;
  const unknownCount = payments.filter((p) => p.status === "UNKNOWN").length;

  // Format period for display
  function formatPeriod(p: string) {
    const [year, month] = p.split("-");
    const date = new Date(Number(year), Number(month) - 1);
    return date.toLocaleString("en-US", { month: "long", year: "numeric" });
  }

  return (
    <div>
      <Flash />
      <PageHeader
        title="Payments"
        description="Track rent payment status across all properties."
        action={
          <ButtonLink href="/payments/log" variant="primary">
            <Banknote className="h-4 w-4" /> Log payment
          </ButtonLink>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{paidCount}</div>
            <div className="text-xs text-slate-400 font-medium">Paid</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center">
            <AlertCircle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{behindCount}</div>
            <div className="text-xs text-slate-400 font-medium">Behind</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center">
            <Clock className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{unknownCount}</div>
            <div className="text-xs text-slate-400 font-medium">Unknown</div>
          </div>
        </div>
      </div>

      {/* Period Selector + Status Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {periods.map(({ period }) => (
            <Link
              key={period}
              href={`/payments?period=${period}${filter !== "all" ? `&status=${filter}` : ""}`}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                period === currentPeriod
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-200 hover:text-indigo-700"
              )}
            >
              {formatPeriod(period)}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {FILTERS.map(({ label, value }) => (
            <Link
              key={value}
              href={`/payments?status=${value}${currentPeriod ? `&period=${currentPeriod}` : ""}`}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                filter === value
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Payments Table */}
      {payments.length === 0 ? (
        <div className="card p-12 text-center">
          <CreditCard className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No payment records found for this period.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Tenant</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Property / Unit</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Period</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Rent</th>
                <th className="text-center px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Method</th>
                <th className="text-center px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Status</th>
                <th className="text-center px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/tenants/${p.lease.tenant.id}`}
                      className="font-medium text-slate-900 hover:text-indigo-600 transition-colors"
                    >
                      {p.lease.tenant.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    <Link href={`/properties/${p.lease.unit.property.id}`} className="hover:text-indigo-600 transition-colors">
                      {p.lease.unit.property.name}
                    </Link>
                    {" · "}
                    {p.lease.unit.label}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatPeriod(p.period)}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">
                    {p.lease.unit.rentAmount ? money(p.lease.unit.rentAmount) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.method ? (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium">
                        {p.method === "ONLINE" ? "Stripe" : p.method === "CHECK" ? "Check" : p.method === "CASH" ? "Cash" : "Other"}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.status === "PAID" ? (
                      <Link
                        href={`/api/receipts?paymentId=${p.id}`}
                        target="_blank"
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        PDF
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
