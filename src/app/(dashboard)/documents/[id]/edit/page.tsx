import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { DocumentForm, type LinkedOptions } from "@/components/DocumentForm";
import {
  updateDocumentMetadata,
  type DocumentFormState,
} from "@/lib/actions/documents";

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

export default async function EditDocumentPage({
  params,
}: {
  params: { id: string };
}) {
  const doc = await prisma.document.findUnique({ where: { id: params.id } });
  if (!doc) notFound();

  const linkedOptions = await loadOptions();

  async function action(prev: DocumentFormState, formData: FormData) {
    "use server";
    return updateDocumentMetadata(params.id, prev, formData);
  }

  return (
    <div>
      <PageHeader title="Edit document" description={doc.filename} />
      <DocumentForm
        action={action}
        mode="edit"
        linkedOptions={linkedOptions}
        initial={{
          type: doc.type,
          linkedEntityType: doc.linkedEntityType,
          linkedEntityId: doc.linkedEntityId,
        }}
        submitLabel="Save changes"
        cancelHref={`/documents/${doc.id}`}
      />
    </div>
  );
}
