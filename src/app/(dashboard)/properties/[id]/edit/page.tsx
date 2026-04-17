import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { PropertyForm } from "@/components/PropertyForm";
import { PropertyPhotoUpload } from "@/components/PropertyPhotoUpload";
import { updateProperty, type PropertyFormState } from "@/lib/actions/properties";
import { getSignedDocumentUrl, getPublicDocumentUrl } from "@/lib/supabase/admin";

export default async function EditPropertyPage({
  params,
}: {
  params: { id: string };
}) {
  const property = await prisma.property.findUnique({ where: { id: params.id } });
  if (!property) notFound();

  // Get signed URL for current photo
  let photoUrl: string | null = null;
  if (property.imageUrl) {
    photoUrl = await getSignedDocumentUrl(property.imageUrl, 60 * 60);
    if (!photoUrl) photoUrl = getPublicDocumentUrl(property.imageUrl);
  }

  async function action(prev: PropertyFormState, formData: FormData) {
    "use server";
    return updateProperty(params.id, prev, formData);
  }

  return (
    <div>
      <PageHeader title="Edit property" description={property.name} />

      <div className="mb-6 card p-6 max-w-2xl">
        <PropertyPhotoUpload
          propertyId={property.id}
          currentImageUrl={photoUrl}
        />
      </div>

      <PropertyForm
        action={action}
        initial={{ name: property.name, address: property.address, notes: property.notes }}
        submitLabel="Save changes"
        cancelHref={`/properties/${property.id}`}
      />
    </div>
  );
}
