import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus, Inbox } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/StatusBadge";
import { DeleteButton } from "@/components/DeleteButton";
import { Flash } from "@/components/Flash";
import { DocumentsSection } from "@/components/DocumentsSection";
import { TicketsSection } from "@/components/TicketsSection";
import { InquiriesSection } from "@/components/InquiriesSection";
import { ExpensesSection } from "@/components/ExpensesSection";
import { deleteProperty } from "@/lib/actions/properties";
import { getSignedDocumentUrl, getPublicDocumentUrl } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function money(n: { toString(): string }) {
  const num = Number(n.toString());
  return `$${num.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export default async function PropertyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const property = await prisma.property.findUnique({
    where: { id: params.id },
    include: {
      units: { orderBy: { label: "asc" } },
    },
  });
  if (!property) notFound();

  // Get signed URL for property photo
  let photoUrl: string | null = null;
  if (property.imageUrl) {
    photoUrl = await getSignedDocumentUrl(property.imageUrl, 60 * 60);
    if (!photoUrl) photoUrl = getPublicDocumentUrl(property.imageUrl);
  }

  return (
    <div>
      <Flash />

      {photoUrl && (
        <div className="mb-6 rounded-xl overflow-hidden border border-slate-200">
          <img
            src={photoUrl}
            alt={property.name}
            className="w-full h-56 object-cover"
          />
        </div>
      )}

      <PageHeader
        title={property.name}
        description={property.address}
        action={
          <div className="flex items-center gap-2">
            <ButtonLink href={`/properties/${property.id}/edit`} variant="secondary">
              <Pencil className="h-4 w-4" /> Edit
            </ButtonLink>
            <ButtonLink href={`/inquiries/new`} variant="secondary">
              <Inbox className="h-4 w-4" /> New inquiry
            </ButtonLink>
            <DeleteButton
              action={async (fd) => {
                "use server";
                fd.append("id", property.id);
                await deleteProperty(fd);
              }}
              confirmText={`Delete "${property.name}" and all ${property.units.length} unit(s)? This cannot be undone.`}
            />
          </div>
        }
      />

      {property.notes && (
        <div className="card p-5 mb-6">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Internal notes</div>
          <p className="text-sm whitespace-pre-wrap">{property.notes}</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Units ({property.units.length})</h2>
        <ButtonLink href={`/properties/${property.id}/units/new`}>
          <Plus className="h-4 w-4" /> Add unit
        </ButtonLink>
      </div>

      {property.units.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-500">
          No units yet. Add the first unit to get started.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-2">Unit</th>
                <th className="text-left px-4 py-2">Beds / Baths</th>
                <th className="text-left px-4 py-2">Rent</th>
                <th className="text-left px-4 py-2">Deposit</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {property.units.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{u.label}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {u.bedrooms} bd / {u.bathrooms} ba
                  </td>
                  <td className="px-4 py-3">{money(u.rentAmount)}</td>
                  <td className="px-4 py-3 text-slate-600">{money(u.depositAmount)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.occupancyStatus} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/units/${u.id}/edit`}
                      className="text-sm text-slate-600 hover:text-slate-900"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TicketsSection by={{ propertyId: property.id }} />
      <ExpensesSection by={{ propertyId: property.id }} />
      <InquiriesSection by={{ propertyId: property.id }} />
      <DocumentsSection entityType="PROPERTY" entityId={property.id} propertyId={property.id} />
    </div>
  );
}
