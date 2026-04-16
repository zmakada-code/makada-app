import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { UnitForm } from "@/components/UnitForm";
import { createUnit, type UnitFormState } from "@/lib/actions/units";

export default async function NewUnitPage({ params }: { params: { id: string } }) {
  const property = await prisma.property.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });
  if (!property) notFound();

  async function action(prev: UnitFormState, formData: FormData) {
    "use server";
    return createUnit(params.id, prev, formData);
  }

  return (
    <div>
      <PageHeader title="Add unit" description={`New unit under ${property.name}`} />
      <UnitForm action={action} submitLabel="Create unit" cancelHref={`/properties/${params.id}`} />
    </div>
  );
}
