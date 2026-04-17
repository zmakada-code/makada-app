import Link from "next/link";
import { Receipt, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ButtonLink } from "@/components/ui/Button";
import { formatDate } from "@/lib/dates";

const categoryLabels: Record<string, string> = {
  REPAIRS: "Repairs",
  MAINTENANCE: "Maintenance",
  MANAGEMENT_FEE: "Mgmt Fee",
  PROPERTY_TAX: "Tax",
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

export async function ExpensesSection({
  by,
}: {
  by: { propertyId: string } | { unitId: string };
}) {
  const where =
    "propertyId" in by
      ? { propertyId: by.propertyId }
      : { unitId: by.unitId };

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { date: "desc" },
    take: 15,
    include: {
      unit: { select: { label: true } },
    },
  });

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Receipt className="h-4 w-4 text-slate-500" /> Expenses ({expenses.length})
          {expenses.length > 0 && (
            <span className="text-xs font-normal text-slate-500">· {money(total)} total</span>
          )}
        </h2>
        <ButtonLink href="/expenses/new" variant="secondary">
          <Plus className="h-4 w-4" /> Add expense
        </ButtonLink>
      </div>
      {expenses.length === 0 ? (
        <div className="card p-5 text-sm text-slate-500">No expenses recorded yet.</div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {expenses.map((e) => (
            <Link
              key={e.id}
              href={`/expenses/${e.id}/edit`}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {e.vendor || e.description}
                </div>
                <div className="text-xs text-slate-500">
                  {categoryLabels[e.category] || e.category}
                  {e.unit ? ` · Unit ${e.unit.label}` : ""}
                  {" · "}
                  {formatDate(e.date)}
                </div>
              </div>
              <span className="text-sm font-semibold text-slate-900 shrink-0">{money(e.amount)}</span>
            </Link>
          ))}
          {"propertyId" in by && expenses.length >= 15 && (
            <Link
              href={`/expenses?property=${by.propertyId}`}
              className="block px-4 py-2 text-center text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
              View all expenses →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
