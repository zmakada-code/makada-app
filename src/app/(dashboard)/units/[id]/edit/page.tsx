import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { UnitForm } from "@/components/UnitForm";
import { DeleteButton } from "@/components/DeleteButton";
import { updateUnit, deleteUnit, type UnitFormState } from "@/lib/actions/units";

export default async function EditUnitPage({ params }: { params: { id: string } }) {
  const unit = await prisma.unit.findUnique({
    where: { id: params.id },
    include: { property: { select: { id: true, name: true } } },
  });
  if (!unit) notFound();

  async function action(prev: UnitFormState, formData: FormData) {
    "use server";
    return updateUnit(params.id, prev, formData);
  }

  return (
    <div>
      <PageHeader
        title="Edit unit"
        description={`${unit.property.name} · Unit ${unit.label}`}
        action={
          <DeleteButton
            action={async (fd) => {
              "use server";
              fd.append("id", unit.id);
              await deleteUnit(fd);
            }}
            confirmText={`Delete unit "${unit.label}"? This cannot be undone.`}
          />
        }
      />
      <UnitForm
        action={action}
        initial={{
          label: unit.label,
          bedrooms: unit.bedrooms,
          bathrooms: unit.bathrooms,
          rentAmount: unit.rentAmount.toString(),
          depositAmount: unit.depositAmount.toString(),
          occupancyStatus: unit.occupancyStatus,
          notes: unit.notes,
        }}
        submitLabel="Save changes"
        cancelHref={`/properties/${unit.propertyId}`}
      />
    </div>
  );
}
