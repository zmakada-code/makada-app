import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { InquiryForm, type UnitOption } from "@/components/InquiryForm";
import { createInquiry } from "@/lib/actions/inquiries";

export const dynamic = "force-dynamic";

async function loadUnits(): Promise<UnitOption[]> {
  const units = await prisma.unit.findMany({
    orderBy: [
      { occupancyStatus: "asc" },
      { property: { name: "asc" } },
      { label: "asc" },
    ],
    select: {
      id: true,
      label: true,
      occupancyStatus: true,
      property: { select: { name: true } },
    },
  });
  return units.map((u) => ({
    value: u.id,
    label: `${u.property.name} · ${u.label}`,
    vacant: u.occupancyStatus === "VACANT" || u.occupancyStatus === "TURNOVER",
  }));
}

export default async function NewInquiryPage({
  searchParams,
}: {
  searchParams: { unitId?: string };
}) {
  const units = await loadUnits();
  return (
    <div>
      <PageHeader
        title="New inquiry"
        description="Log a lead from the public site, a walk-in, or a referral."
      />
      <InquiryForm
        action={createInquiry}
        units={units}
        initial={{ unitId: searchParams.unitId ?? "" }}
        submitLabel="Create inquiry"
        cancelHref="/inquiries"
      />
    </div>
  );
}
