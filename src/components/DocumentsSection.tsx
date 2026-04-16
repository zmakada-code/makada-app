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
  RULES: "House rules",
  OTHER: "Other",
};

export async function DocumentsSection({
  entityType,
  entityId,
}: {
  entityType: LinkedEntityType;
  entityId: string;
}) {
  const docs = await prisma.document.findMany({
    where: { linkedEntityType: entityType, linkedEntityId: entityId },
    orderBy: { uploadedAt: "desc" },
  });

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
                  {typeLabels[d.type]} · uploaded {formatDate(d.uploadedAt)}
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
