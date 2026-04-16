import Link from "next/link";
import { Building2, Plus, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { Flash } from "@/components/Flash";

export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  const properties = await prisma.property.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      units: {
        select: { id: true, occupancyStatus: true },
      },
    },
  });

  return (
    <div>
      <Flash />
      <PageHeader
        title="Properties"
        description="Portfolio overview. Click a property to see its units."
        action={
          <ButtonLink href="/properties/new">
            <Plus className="h-4 w-4" /> Add property
          </ButtonLink>
        }
      />

      {properties.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No properties yet"
          description="Add a property, then add units to it. Leases, tickets, and documents all attach to units."
          actionLabel="Add your first property"
          actionHref="/properties/new"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((p) => {
            const total = p.units.length;
            const occupied = p.units.filter((u) => u.occupancyStatus === "OCCUPIED").length;
            const vacant = p.units.filter((u) => u.occupancyStatus === "VACANT").length;
            return (
              <Link
                key={p.id}
                href={`/properties/${p.id}`}
                className="card p-5 hover:border-slate-300 hover:shadow-sm transition group"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">{p.address}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500" />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <Stat label="Units" value={total} />
                  <Stat label="Occupied" value={occupied} />
                  <Stat label="Vacant" value={vacant} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-slate-50 py-2">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
