import Link from "next/link";
import { FolderOpen, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import type { LinkedEntityType } from "@prisma/client";
import { ButtonLink } from "@/components/ui/Button";
import { formatDate } from "@/lib/dates";

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

/**
 * Shows documents for a given entity.
 *
 * Two modes:
 *   1. Simple: entityType + entityId — shows documents linked to that single entity.
 *   2. Property-wide: propertyId — shows documents linked to the property AND
 *      all its child units/leases, so receipts and generated leases appear here.
 *
 * When propertyId is provided, the upload button still links to the property entity.
 */
export async function DocumentsSection({
  entityType,
  entityId,
  propertyId,
}: {
  entityType: LinkedEntityType;
  entityId: string;
  propertyId?: string;
}) {
  let docs;

  if (propertyId) {
    // Fetch all unit IDs and lease IDs for this property so we can include
    // their linked documents (receipts, generated leases, etc.)
    const units = await prisma.unit.findMany({
      where: { propertyId },
      select: { id: true, leases: { select: { id: true } } },
    });
    const unitIds = units.map((u) => u.id);
    const leaseIds = units.flatMap((u) => u.leases.map((l) => l.id));

    // Build an OR filter: property-level docs + unit-level docs + lease-level docs
    const conditions: { linkedEntityType: LinkedEntityType; linkedEntityId: string }[] = [
      { linkedEntityType: "PROPERTY", linkedEntityId: propertyId },
    ];
    for (const id of unitIds) {
      conditions.push({ linkedEntityType: "UNIT", linkedEntityId: id });
    }
    for (const id of leaseIds) {
      conditions.push({ linkedEntityType: "LEASE", linkedEntityId: id });
    }

    docs = await prisma.document.findMany({
      where: { OR: conditions },
      orderBy: { uploadedAt: "desc" },
    });
  } else {
    docs = await prisma.document.findMany({
      where: { linkedEntityType: entityType, linkedEntityId: entityId },
      orderBy: { uploadedAt: "desc" },
    });
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-slate-500" /> Documents ({docs.length})
        </h2>
        <ButtonLink
          href={`/documents/new?linkedEntityType=${entityType}&linkedEntityId=${entityId}`}
          variant="secondary"
        >
          <Plus className="h-4 w-4" /> Upload
        </ButtonLink>
      </div>
      {docs.length === 0 ? (
        <div className="card p-5 text-sm text-slate-500">No documents attached yet.</div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {docs.map((d) => (
            <Link
              key={d.id}
              href={`/documents/${d.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{d.filename}</div>
                <div className="text-xs text-slate-500">
                  {typeLabels[d.type] || d.type} · uploaded {formatDate(d.uploadedAt)}
                </div>
              </div>
              <span className="text-xs text-slate-400">Open →</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
