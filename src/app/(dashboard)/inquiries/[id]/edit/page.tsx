import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { InquiryForm, type UnitOption } from "@/components/InquiryForm";
import {
  updateInquiry,
  type InquiryFormState,
} from "@/lib/actions/inquiries";

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

export default async function EditInquiryPage({
  params,
}: {
  params: { id: string };
}) {
  const inquiry = await prisma.inquiry.findUnique({ where: { id: params.id } });
  if (!inquiry) notFound();

  const units = await loadUnits();

  async function action(prev: InquiryFormState, formData: FormData) {
    "use server";
    return updateInquiry(params.id, prev, formData);
  }

  return (
    <div>
      <PageHeader
        title="Edit inquiry"
        description={inquiry.prospectName}
      />
      <InquiryForm
        action={action}
        units={units}
        initial={{
          prospectName: inquiry.prospectName,
          phone: inquiry.phone,
          email: inquiry.email,
          message: inquiry.message,
          unitId: inquiry.unitId,
          source: inquiry.source,
          status: inquiry.status,
        }}
        submitLabel="Save changes"
        cancelHref={`/inquiries/${inquiry.id}`}
      />
    </div>
  );
}
