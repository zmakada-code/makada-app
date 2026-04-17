import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Flash } from "@/components/Flash";
import { ExpenseForm } from "./ExpenseForm";

export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  const properties = await prisma.property.findMany({
    orderBy: { name: "asc" },
    include: {
      units: { orderBy: { label: "asc" }, select: { id: true, label: true } },
    },
  });

  return (
    <div>
      <Flash />
      <PageHeader
        title="Add Expense"
        description="Log a bill, repair, tax, or other cost."
        action={
          <ButtonLink href="/expenses" variant="secondary">
            Back to Expenses
          </ButtonLink>
        }
      />
      <div className="card p-6 max-w-lg">
        <ExpenseForm properties={properties.map((p) => ({
          id: p.id,
          name: p.name,
          units: p.units,
        }))} />
      </div>
    </div>
  );
}
