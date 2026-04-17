import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { DeleteButton } from "@/components/DeleteButton";
import { ExpenseForm, type ExpenseInitial } from "../../new/ExpenseForm";

export const dynamic = "force-dynamic";

export default async function EditExpensePage({
  params,
}: {
  params: { id: string };
}) {
  const expense = await prisma.expense.findUnique({
    where: { id: params.id },
  });
  if (!expense) notFound();

  const properties = await prisma.property.findMany({
    orderBy: { name: "asc" },
    include: {
      units: { orderBy: { label: "asc" }, select: { id: true, label: true } },
    },
  });

  const initial: ExpenseInitial = {
    propertyId: expense.propertyId,
    unitId: expense.unitId || "",
    category: expense.category,
    vendor: expense.vendor || "",
    description: expense.description,
    amount: Number(expense.amount).toString(),
    date: expense.date.toISOString().split("T")[0],
    reference: expense.reference || "",
    note: expense.note || "",
  };

  async function deleteExpense() {
    "use server";
    await prisma.expense.delete({ where: { id: params.id } });
    redirect("/expenses?flash=Expense+deleted");
  }

  return (
    <div>
      <PageHeader
        title="Edit Expense"
        description={expense.description}
        action={
          <div className="flex items-center gap-2">
            <ButtonLink href="/expenses" variant="secondary">
              Back to Expenses
            </ButtonLink>
            <DeleteButton
              action={deleteExpense}
              confirmText="Delete this expense? This cannot be undone."
            />
          </div>
        }
      />
      <div className="card p-6 max-w-lg">
        <ExpenseForm
          properties={properties.map((p) => ({
            id: p.id,
            name: p.name,
            units: p.units,
          }))}
          initial={initial}
          expenseId={params.id}
        />
      </div>
    </div>
  );
}
