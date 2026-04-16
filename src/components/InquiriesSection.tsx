import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ButtonLink } from "@/components/ui/Button";
import { InquiryStatusBadge } from "@/components/InquiryStatusBadge";
import { formatDate } from "@/lib/dates";
import { Plus } from "lucide-react";

type ByUnit = { unitId: string };
type ByProperty = { propertyId: string };

export async function InquiriesSection({
  by,
}: {
  by: ByUnit | ByProperty;
}) {
  const where =
    "unitId" in by
      ? { unitId: by.unitId }
      : { unit: { propertyId: by.propertyId } };

  const inquiries = await prisma.inquiry.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 25,
    include: {
      unit: {
        select: { id: true, label: true, property: { select: { id: true, name: true } } },
      },
    },
  });

  const newHref =
    "unitId" in by
      ? `/inquiries/new?unitId=${by.unitId}`
      : `/inquiries/new`;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Inquiries ({inquiries.length})</h2>
        <ButtonLink href={newHref} variant="secondary">
          <Plus className="h-4 w-4" /> New inquiry
        </ButtonLink>
      </div>
      {inquiries.length === 0 ? (
        <div className="card p-6 text-sm text-slate-500">No inquiries linked yet.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-2">Prospect</th>
                <th className="text-left px-4 py-2">Unit</th>
                <th className="text-left px-4 py-2">Source</th>
                <th className="text-left px-4 py-2">Created</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {inquiries.map((i) => (
                <tr key={i.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/inquiries/${i.id}`} className="hover:underline">
                      {i.prospectName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {i.unit
                      ? `${i.unit.property.name} · ${i.unit.label}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{i.source}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(i.createdAt)}</td>
                  <td className="px-4 py-3">
                    <InquiryStatusBadge status={i.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/inquiries/${i.id}`}
                      className="text-sm text-slate-600 hover:text-slate-900"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
