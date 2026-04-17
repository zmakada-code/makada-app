import Link from "next/link";
import { Receipt, Plus, ArrowRight } from "lucide-react";
import clsx from "clsx";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Flash } from "@/components/Flash";
import { formatDate } from "@/lib/dates";
import type { ExpenseCategory } from "@prisma/client";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  REPAIRS: "Repairs",
  MAINTENANCE: "Maintenance",
  MANAGEMENT_FEE: "Management Fee",
  PROPERTY_TAX: "Property Tax",
  INSURANCE: "Insurance",
  UTILITIES: "Utilities",
  LANDSCAPING: "Landscaping",
  CLEANING: "Cleaning",
  PEST_CONTROL: "Pest Control",
  LEGAL: "Legal",
  SUPPLIES: "Supplies",
  OTHER: "Other",
};

function money(n: { toString(): string }) {
  return `$${Number(n.toString()).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: { property?: string; category?: string };
}) {
  const propertyFilter = searchParams.property;
  const categoryFilter = searchParams.category;

  const where: Record<string, unknown> = {};
  if (propertyFilter) where.propertyId = propertyFilter;
  if (categoryFilter) where.category = categoryFilter;

  const [expenses, properties, totalResult] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: {
        property: { select: { name: true } },
        unit: { select: { label: true } },
      },
      orderBy: { date: "desc" },
      take: 50,
    }),
    prisma.property.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
  ]);

  const total = totalResult._sum.amount ? Number(totalResult._sum.amount) : 0;

  return (
    <div>
      <Flash />
      <PageHeader
        title="Expenses"
        description="Track bills, repairs, taxes, and other property costs."
        action={
          <ButtonLink href="/expenses/new" variant="primary">
            <Plus className="h-4 w-4" /> Add expense
          </ButtonLink>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          defaultValue={propertyFilter || ""}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
        >
          <option value="">All properties</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div className="ml-auto text-sm font-semibold text-slate-900">
          Total: {money(total)}
        </div>
      </div>

      {/* Table */}
      {expenses.length === 0 ? (
        <div className="card p-12 text-center">
          <Receipt className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No expenses recorded yet.</p>
          <Link href="/expenses/new" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium mt-2 inline-block">
            Add your first expense
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Vendor</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Description</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Property</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Category</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(e.date)}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{e.vendor || "—"}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{e.description}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {e.property.name}
                    {e.unit ? ` · ${e.unit.label}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {CATEGORY_LABELS[e.category]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{money(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
