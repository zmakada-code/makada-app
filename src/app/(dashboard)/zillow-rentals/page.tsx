import Link from "next/link";
import { Home, ExternalLink, Eye, EyeOff } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { Flash } from "@/components/Flash";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function ZillowRentalsPage() {
  // Get all vacant units (both published and unpublished)
  const units = await prisma.unit.findMany({
    where: { occupancyStatus: "VACANT" },
    include: {
      property: { select: { id: true, name: true, address: true } },
    },
    orderBy: [{ isPublished: "desc" }, { property: { name: "asc" } }, { label: "asc" }],
  });

  const publishedCount = units.filter((u) => u.isPublished).length;
  const draftCount = units.length - publishedCount;

  return (
    <div>
      <Flash />
      <PageHeader
        title="Zillow Rentals"
        description="Manage your vacant unit listings. Add photos, descriptions, and Zillow links before publishing to the properties website."
      />

      {units.length === 0 ? (
        <EmptyState
          icon={Home}
          title="No vacant units"
          description="All units are currently occupied. Vacant units will appear here automatically."
        />
      ) : (
        <>
          <div className="mb-4 flex items-center gap-4 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-emerald-500" />
              {publishedCount} published
            </span>
            <span className="inline-flex items-center gap-1.5">
              <EyeOff className="h-3.5 w-3.5 text-slate-400" />
              {draftCount} draft
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {units.map((unit) => (
              <Link
                key={unit.id}
                href={`/zillow-rentals/${unit.id}`}
                className="card p-5 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {unit.property.name}
                    </p>
                    <h3 className="mt-0.5 text-base font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      Unit {unit.label}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{unit.property.address}</p>
                  </div>
                  {unit.isPublished ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      <Eye className="h-3 w-3" /> Live
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      <EyeOff className="h-3 w-3" /> Draft
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-sm text-slate-600 mb-3">
                  <span>{unit.bedrooms} bd</span>
                  <span>{unit.bathrooms} ba</span>
                  <span className="ml-auto font-semibold text-slate-900">
                    ${Number(unit.rentAmount).toLocaleString()}/mo
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  {unit.publicDescription ? (
                    <p className="text-slate-500 line-clamp-2">{unit.publicDescription}</p>
                  ) : (
                    <p className="text-amber-600">No description added yet</p>
                  )}
                  {unit.zillowUrl ? (
                    <p className="text-indigo-600 flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> Zillow link added
                    </p>
                  ) : (
                    <p className="text-amber-600">No Zillow link yet</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
