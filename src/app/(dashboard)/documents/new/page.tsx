import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { DocumentForm, type LinkedOptions } from "@/components/DocumentForm";
import { createDocument } from "@/lib/actions/documents";
import type { LinkedEntityType } from "@prisma/client";

export const dynamic = "force-dynamic";

async function loadOptions(): Promise<LinkedOptions> {
  const [properties, units, tenants, leases] = await Promise.all([
    prisma.property.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.unit.findMany({
      orderBy: [{ property: { name: "asc" } }, { label: "asc" }],
      select: { id: true, label: true, property: { select: { name: true } } },
    }),
    prisma.tenant.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    prisma.lease.findMany({
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        tenant: { select: { fullName: true } },
        unit: { select: { label: true, property: { select: { name: true } } } },
      },
    }),
  ]);

  return {
    PROPERTY: properties.map((p) => ({ value: p.id, label: p.name })),
    UNIT: units.map((u) => ({
      value: u.id,
      label: `${u.property.name} · ${u.label}`,
    })),
    TENANT: tenants.map((t) => ({ value: t.id, label: t.fullName })),
    LEASE: leases.map((l) => ({
      value: l.id,
      label: `${l.tenant.fullName} · ${l.unit.property.name} · ${l.unit.label}`,
    })),
  };
}

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: { linkedEntityType?: string; linkedEntityId?: string };
}) {
  const linkedOptions = await loadOptions();
  const prefillType = (["PROPERTY", "UNIT", "TENANT", "LEASE"] as const).includes(
    searchParams.linkedEntityType as LinkedEntityType
  )
    ? (searchParams.linkedEntityType as LinkedEntityType)
    : "PROPERTY";

  return (
    <div>
      <PageHeader title="Upload document" description="PDF, JPG, or PNG — up to 10 MB." />
      <DocumentForm
        action={createDocument}
        mode="upload"
        linkedOptions={linkedOptions}
        initial={{
          type: "OTHER",
          linkedEntityType: prefillType,
          linkedEntityId: searchParams.linkedEntityId ?? "",
        }}
        submitLabel="Upload"
        cancelHref="/documents"
      />
    </div>
  );
}
