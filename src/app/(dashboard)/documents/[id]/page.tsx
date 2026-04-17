import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { DeleteButton } from "@/components/DeleteButton";
import { Flash } from "@/components/Flash";
import { formatDate } from "@/lib/dates";
import { getSignedDocumentUrl } from "@/lib/supabase/admin";
import { deleteDocument } from "@/lib/actions/documents";

export const dynamic = "force-dynamic";

const typeLabels: Record<string, string> = {
  LEASE: "Lease",
  NOTICE: "Notice",
  RECEIPT: "Receipt",
  INVOICE: "Invoice",
  TAX: "Tax",
  INSURANCE: "Insurance",
  RULES: "House rules",
  OTHER: "Other",
};

async function resolveLinked(type: string, id: string) {
  if (type === "PROPERTY") {
    const p = await prisma.property.findUnique({ where: { id }, select: { name: true } });
    return p ? { label: `Property · ${p.name}`, href: `/properties/${id}` } : null;
  }
  if (type === "UNIT") {
    const u = await prisma.unit.findUnique({
      where: { id },
      select: { label: true, propertyId: true, property: { select: { name: true } } },
    });
    return u
      ? { label: `Unit · ${u.property.name} · ${u.label}`, href: `/properties/${u.propertyId}` }
      : null;
  }
  if (type === "TENANT") {
    const t = await prisma.tenant.findUnique({ where: { id }, select: { fullName: true } });
    return t ? { label: `Tenant · ${t.fullName}`, href: `/tenants/${id}` } : null;
  }
  if (type === "LEASE") {
    const l = await prisma.lease.findUnique({
      where: { id },
      select: {
        tenant: { select: { fullName: true } },
        unit: { select: { label: true, property: { select: { name: true } } } },
      },
    });
    return l
      ? {
          label: `Lease · ${l.tenant.fullName} · ${l.unit.property.name} · ${l.unit.label}`,
          href: `/leases/${id}/edit`,
        }
      : null;
  }
  return null;
}

export default async function DocumentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const doc = await prisma.document.findUnique({ where: { id: params.id } });
  if (!doc) notFound();

  const [signedUrl, linked] = await Promise.all([
    getSignedDocumentUrl(doc.storagePath),
    resolveLinked(doc.linkedEntityType, doc.linkedEntityId),
  ]);

  return (
    <div>
      <Flash />
      <PageHeader
        title={doc.filename}
        description={`${typeLabels[doc.type]} · uploaded ${formatDate(doc.uploadedAt)}`}
        action={
          <div className="flex items-center gap-2">
            {signedUrl && (
              <a
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium px-3 py-2 bg-slate-900 text-white hover:bg-slate-800"
              >
                Open
              </a>
            )}
            <ButtonLink href={`/documents/${doc.id}/edit`} variant="secondary">
              <Pencil className="h-4 w-4" /> Edit
            </ButtonLink>
            <DeleteButton
              action={async (fd) => {
                "use server";
                fd.append("id", doc.id);
                await deleteDocument(fd);
              }}
              confirmText="Delete this document? The file will be removed from storage too."
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Linked to</div>
          {linked ? (
            <Link href={linked.href} className="text-sm hover:underline">
              {linked.label}
            </Link>
          ) : (
            <div className="text-sm text-slate-400">Linked record no longer exists.</div>
          )}
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Storage</div>
          <div className="text-xs font-mono break-all text-slate-600">{doc.storagePath}</div>
          {!signedUrl && (
            <div className="text-xs text-red-600 mt-2">
              Could not generate a signed URL. Check that the bucket <code>documents</code> exists and the service role key is set.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
