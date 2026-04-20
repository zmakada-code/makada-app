import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { Flash } from "@/components/Flash";
import { ListingEditor } from "./ListingEditor";

export const dynamic = "force-dynamic";

export default async function EditListingPage({
  params,
}: {
  params: { id: string };
}) {
  const unit = await prisma.unit.findUnique({
    where: { id: params.id },
    include: {
      property: { select: { id: true, name: true, address: true, imageUrl: true } },
    },
  });

  if (!unit) notFound();

  // Parse listing photos
  let listingPhotoPaths: string[] = [];
  if (unit.listingPhotos) {
    try {
      listingPhotoPaths = JSON.parse(unit.listingPhotos);
    } catch { /* ignore */ }
  }

  return (
    <div>
      <Flash />
      <div className="mb-4">
        <Link
          href="/zillow-rentals"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Zillow Rentals
        </Link>
      </div>

      <PageHeader
        title={`${unit.property.name} — Unit ${unit.label}`}
        description={`${unit.property.address} · ${unit.bedrooms} bd · ${unit.bathrooms} ba · $${Number(unit.rentAmount).toLocaleString()}/mo`}
      />

      <ListingEditor
        unitId={unit.id}
        propertyName={unit.property.name}
        unitLabel={unit.label}
        currentDescription={unit.publicDescription ?? ""}
        currentZillowUrl={unit.zillowUrl ?? ""}
        currentPhotoPaths={listingPhotoPaths}
        isPublished={unit.isPublished}
      />
    </div>
  );
}
