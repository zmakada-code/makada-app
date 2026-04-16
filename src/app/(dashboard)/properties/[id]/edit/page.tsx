import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { PropertyForm } from "@/components/PropertyForm";
import { updateProperty, type PropertyFormState } from "@/lib/actions/properties";

export default async function EditPropertyPage({
  params,
}: {
  params: { id: string };
}) {
  const property = await prisma.property.findUnique({ where: { id: params.id } });
  if (!property) notFound();

  async function action(prev: PropertyFormState, formData: FormData) {
    "use server";
    return updateProperty(params.id, prev, formData);
  }

  return (
    <div>
      <PageHeader title="Edit property" description={property.name} />
      <PropertyForm
        action={action}
        initial={{ name: property.name, address: property.address, notes: property.notes }}
        submitLabel="Save changes"
        cancelHref={`/properties/${property.id}`}
      />
    </div>
  );
}
