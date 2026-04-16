import Link from "next/link";
import { FolderOpen, Plus } from "lucide-react";
import clsx from "clsx";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { Flash } from "@/components/Flash";
import { formatDate } from "@/lib/dates";
import type { LinkedEntityType } from "@prisma/client";

export const dynamic = "force-dynamic";

const FILTERS: { label: string; value: "all" | LinkedEntityType }[] = [
  { label: "All", value: "all" },
  { label: "Property", value: "PROPERTY" },
  { label: "Unit", value: "UNIT" },
  { label: "Tenant", value: "TENANT" },
  { label: "Lease", value: "LEASE" },
];

const typeLabels: Record<string, string> = {
  LEASE: "Lease",
  NOTICE: "Notice",
  RECEIPT: "Receipt",
  RULES: "House rules",
  OTHER: "Other",
};

async function resolveLinkedLabel(
  type: LinkedEntityType,
  id: string
): Promise<{ label: string; href: string } | null> {
  if (type === "PROPERTY") {
    const p = await prisma.property.findUnique({ where: { id }, select: { name: true } });
    return p ? { label: p.name, href: `/properties/${id}` } : null;
  }
  if (type === "UNIT") {
    const u = await prisma.unit.findUnique({
      where: { id },
      select: { label: true, propertyId: true, property: { select: { name: true } } },
    });
    return u
      ? { label: `${u.property.name} · ${u.label}`, href: `/properties/${u.propertyId}` }
      : null;
  }
  if (type === "TENANT") {
    const t = await prisma.tenant.findUnique({ where: { id }, select: { fullName: true } });
    return t ? { label: t.fullName, href: `/tenants/${id}` } : null;
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
          label: `${l.tenant.fullName} · ${l.unit.property.name} · ${l.unit.label}`,
          href: `/leases/${id}/edit`,
        }
      : null;
  }
  return null;
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const filter =
    FILTERS.find((f) => f.value === searchParams.type)?.value ?? "all";
  const where = filter === "all" ? {} : { linkedEntityType: filter as LinkedEntityType };

  const docs = await prisma.document.findMany({
    where,
    orderBy: { uploadedAt: "desc" },
  });

  const linked = await Promise.all(
    docs.map((d) => resolveLinkedLabel(d.linkedEntityType, d.linkedEntityId))
  );

  return (
    <div>
      <Flash />
      <PageHeader
        title="Documents"
        description="Internal file library."
        action={
          <ButtonLink href="/documents/new">
            <Plus className="h-4 w-4" /> Upload document
          </ButtonLink>
        }
      />

      <div className="flex items-center gap-2 mb-4">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          const href = f.value === "all" ? "/documents" : `/documents?type=${f.value}`;
          return (
            <Link
              key={f.value}
              href={href}
              className={clsx(
                "rounded-full border px-3 py-1 text-xs font-medium transition",
                active
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {docs.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No documents"
          description={
            filter === "all"
              ? "Upload your first document."
              : "No documents linked to this record type yet."
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-2">Filename</th>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-left px-4 py-2">Linked to</th>
                <th className="text-left px-4 py-2">Uploaded</th>
                <th className="text-right px-4 py-2">&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d, i) => {
                const link = linked[i];
                return (
                  <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/documents/${d.id}`} className="hover:underline">
                        {d.filename}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{typeLabels[d.type]}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="text-xs uppercase text-slate-400 mr-1">
                        {d.linkedEntityType.toLowerCase()}
                      </span>
                      {link ? (
                        <Link href={link.href} className="hover:underline">
                          {link.label}
                        </Link>
                      ) : (
                        <span className="text-slate-400">deleted</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(d.uploadedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/documents/${d.id}`}
                        className="text-sm text-slate-600 hover:text-slate-900"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
