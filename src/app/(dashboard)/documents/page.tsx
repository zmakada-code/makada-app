import Link from "next/link";
import { Building2, FolderOpen, Plus, ChevronDown } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { Flash } from "@/components/Flash";
import { formatDate } from "@/lib/dates";
import type { LinkedEntityType } from "@prisma/client";

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

const typeBadgeColors: Record<string, string> = {
  LEASE: "bg-blue-50 text-blue-700",
  RECEIPT: "bg-green-50 text-green-700",
  NOTICE: "bg-amber-50 text-amber-700",
  INVOICE: "bg-purple-50 text-purple-700",
  TAX: "bg-rose-50 text-rose-700",
  INSURANCE: "bg-teal-50 text-teal-700",
  RULES: "bg-slate-100 text-slate-700",
  OTHER: "bg-slate-100 text-slate-600",
};

type DocRow = {
  id: string;
  filename: string;
  type: string;
  linkedEntityType: LinkedEntityType;
  linkedEntityId: string;
  uploadedAt: Date;
  linkLabel: string;
  linkHref: string;
};

type PropertyGroup = {
  propertyId: string;
  propertyName: string;
  propertyAddress: string;
  docs: DocRow[];
};

/**
 * Resolve a document's linked entity to a property ID plus a display label.
 */
async function resolveToProperty(
  entityType: LinkedEntityType,
  entityId: string
): Promise<{ propertyId: string; propertyName: string; propertyAddress: string; linkLabel: string; linkHref: string } | null> {
  if (entityType === "PROPERTY") {
    const p = await prisma.property.findUnique({ where: { id: entityId }, select: { id: true, name: true, address: true } });
    return p ? { propertyId: p.id, propertyName: p.name, propertyAddress: p.address, linkLabel: p.name, linkHref: `/properties/${p.id}` } : null;
  }
  if (entityType === "UNIT") {
    const u = await prisma.unit.findUnique({
      where: { id: entityId },
      select: { label: true, propertyId: true, property: { select: { name: true, address: true } } },
    });
    return u
      ? { propertyId: u.propertyId, propertyName: u.property.name, propertyAddress: u.property.address, linkLabel: `${u.property.name} · ${u.label}`, linkHref: `/properties/${u.propertyId}` }
      : null;
  }
  if (entityType === "TENANT") {
    const t = await prisma.tenant.findUnique({
      where: { id: entityId },
      select: {
        fullName: true,
        leases: {
          take: 1,
          orderBy: { startDate: "desc" },
          select: { unit: { select: { propertyId: true, label: true, property: { select: { name: true, address: true } } } } },
        },
      },
    });
    if (!t) return null;
    const lease = t.leases[0];
    if (lease) {
      return {
        propertyId: lease.unit.propertyId,
        propertyName: lease.unit.property.name,
        propertyAddress: lease.unit.property.address,
        linkLabel: t.fullName,
        linkHref: `/tenants/${entityId}`,
      };
    }
    // Tenant with no lease — put in "Unlinked"
    return { propertyId: "__unlinked__", propertyName: "Unlinked", propertyAddress: "", linkLabel: t.fullName, linkHref: `/tenants/${entityId}` };
  }
  if (entityType === "LEASE") {
    const l = await prisma.lease.findUnique({
      where: { id: entityId },
      select: {
        tenant: { select: { fullName: true } },
        unit: { select: { label: true, propertyId: true, property: { select: { name: true, address: true } } } },
      },
    });
    return l
      ? {
          propertyId: l.unit.propertyId,
          propertyName: l.unit.property.name,
          propertyAddress: l.unit.property.address,
          linkLabel: `${l.tenant.fullName} · ${l.unit.label}`,
          linkHref: `/leases/${entityId}/edit`,
        }
      : null;
  }
  return null;
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: { property?: string };
}) {
  const docs = await prisma.document.findMany({
    orderBy: { uploadedAt: "desc" },
  });

  // Resolve each document to its property
  const resolved = await Promise.all(
    docs.map(async (d) => {
      const info = await resolveToProperty(d.linkedEntityType, d.linkedEntityId);
      return { doc: d, info };
    })
  );

  // Group by property
  const groupMap = new Map<string, PropertyGroup>();

  for (const { doc, info } of resolved) {
    const propId = info?.propertyId ?? "__unlinked__";
    const propName = info?.propertyName ?? "Unlinked";
    const propAddr = info?.propertyAddress ?? "";

    if (!groupMap.has(propId)) {
      groupMap.set(propId, {
        propertyId: propId,
        propertyName: propName,
        propertyAddress: propAddr,
        docs: [],
      });
    }

    groupMap.get(propId)!.docs.push({
      id: doc.id,
      filename: doc.filename,
      type: doc.type,
      linkedEntityType: doc.linkedEntityType,
      linkedEntityId: doc.linkedEntityId,
      uploadedAt: doc.uploadedAt,
      linkLabel: info?.linkLabel ?? "deleted",
      linkHref: info?.linkHref ?? "#",
    });
  }

  // Sort: real properties first (alphabetically), then "Unlinked" last
  const groups = Array.from(groupMap.values()).sort((a, b) => {
    if (a.propertyId === "__unlinked__") return 1;
    if (b.propertyId === "__unlinked__") return -1;
    return a.propertyName.localeCompare(b.propertyName);
  });

  // If a property filter is active, only show that one
  const filterPropId = searchParams.property;
  const filteredGroups = filterPropId
    ? groups.filter((g) => g.propertyId === filterPropId)
    : groups;

  const totalDocs = docs.length;

  return (
    <div>
      <Flash />
      <PageHeader
        title="Documents"
        description={`${totalDocs} document${totalDocs !== 1 ? "s" : ""} across ${groups.length} propert${groups.length !== 1 ? "ies" : "y"}.`}
        action={
          <ButtonLink href="/documents/new">
            <Plus className="h-4 w-4" /> Upload document
          </ButtonLink>
        }
      />

      {/* Property filter pills */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Link
          href="/documents"
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
            !filterPropId
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          All properties
        </Link>
        {groups
          .filter((g) => g.propertyId !== "__unlinked__")
          .map((g) => (
            <Link
              key={g.propertyId}
              href={`/documents?property=${g.propertyId}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                filterPropId === g.propertyId
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {g.propertyName}
              <span className="ml-1 text-[10px] opacity-60">{g.docs.length}</span>
            </Link>
          ))}
      </div>

      {totalDocs === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No documents"
          description="Upload your first document."
        />
      ) : (
        <div className="space-y-6">
          {filteredGroups.map((group) => (
            <details key={group.propertyId} open className="group">
              <summary className="flex items-center gap-3 cursor-pointer list-none rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 hover:bg-slate-100 transition">
                <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-0 -rotate-90" />
                <Building2 className="h-4 w-4 text-indigo-500" />
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-sm text-slate-900">{group.propertyName}</span>
                  {group.propertyAddress && (
                    <span className="ml-2 text-xs text-slate-400">{group.propertyAddress}</span>
                  )}
                </div>
                <span className="text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5">
                  {group.docs.length} doc{group.docs.length !== 1 ? "s" : ""}
                </span>
              </summary>

              <div className="mt-2 card overflow-hidden">
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
                    {group.docs.map((d) => (
                      <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium">
                          <Link href={`/documents/${d.id}`} className="hover:underline">
                            {d.filename}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${typeBadgeColors[d.type] || typeBadgeColors.OTHER}`}>
                            {typeLabels[d.type] || d.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <span className="text-[10px] uppercase text-slate-400 mr-1">
                            {d.linkedEntityType.toLowerCase()}
                          </span>
                          {d.linkHref !== "#" ? (
                            <Link href={d.linkHref} className="hover:underline">
                              {d.linkLabel}
                            </Link>
                          ) : (
                            <span className="text-slate-400">{d.linkLabel}</span>
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
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
