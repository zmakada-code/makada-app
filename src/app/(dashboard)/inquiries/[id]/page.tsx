import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, UserPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { ButtonLink, Button } from "@/components/ui/Button";
import { DeleteButton } from "@/components/DeleteButton";
import { Flash } from "@/components/Flash";
import { InquiryStatusBadge } from "@/components/InquiryStatusBadge";
import {
  deleteInquiry,
  setInquiryStatus,
} from "@/lib/actions/inquiries";
import { formatDate } from "@/lib/dates";
import type { InquiryStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const sourceLabels: Record<string, string> = {
  WEBSITE: "Website",
  WALK_IN: "Walk-in",
  REFERRAL: "Referral",
  OTHER: "Other",
};

function nextStatuses(current: InquiryStatus): InquiryStatus[] {
  const order: Record<InquiryStatus, InquiryStatus[]> = {
    NEW: ["CONTACTED", "REJECTED"],
    CONTACTED: ["TOURED", "REJECTED"],
    TOURED: ["CONVERTED", "REJECTED"],
    REJECTED: ["NEW"],
    CONVERTED: [],
  };
  return order[current];
}

const nextLabel: Record<InquiryStatus, string> = {
  NEW: "Mark new",
  CONTACTED: "Mark contacted",
  TOURED: "Mark toured",
  REJECTED: "Reject",
  CONVERTED: "Mark converted",
};

export default async function InquiryDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: params.id },
    include: {
      unit: {
        select: {
          id: true,
          label: true,
          occupancyStatus: true,
          property: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!inquiry) notFound();

  const transitions = nextStatuses(inquiry.status);

  const convertHref =
    `/tenants/new?fromInquiry=${inquiry.id}` +
    `&fullName=${encodeURIComponent(inquiry.prospectName)}` +
    (inquiry.phone ? `&phone=${encodeURIComponent(inquiry.phone)}` : "") +
    (inquiry.email ? `&email=${encodeURIComponent(inquiry.email)}` : "");

  return (
    <div>
      <Flash />
      <PageHeader
        title={inquiry.prospectName}
        description={`Inquiry · ${sourceLabels[inquiry.source] ?? inquiry.source} · created ${formatDate(inquiry.createdAt)}`}
        action={
          <div className="flex items-center gap-2">
            {inquiry.status !== "CONVERTED" && (
              <ButtonLink href={convertHref} variant="secondary">
                <UserPlus className="h-4 w-4" /> Create tenant
              </ButtonLink>
            )}
            <ButtonLink href={`/inquiries/${inquiry.id}/edit`} variant="secondary">
              <Pencil className="h-4 w-4" /> Edit
            </ButtonLink>
            <DeleteButton
              action={async (fd) => {
                "use server";
                fd.append("id", inquiry.id);
                await deleteInquiry(fd);
              }}
              confirmText="Delete this inquiry? This cannot be undone."
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wide text-slate-400">Status</div>
            <InquiryStatusBadge status={inquiry.status} />
          </div>
          {transitions.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-3">
              {transitions.map((next) => (
                <form
                  key={next}
                  action={async (fd) => {
                    "use server";
                    fd.append("id", inquiry.id);
                    fd.append("status", next);
                    await setInquiryStatus(fd);
                  }}
                >
                  <Button type="submit" variant="secondary">
                    {nextLabel[next]}
                  </Button>
                </form>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-500 mt-3">
              This inquiry has been converted. No further transitions.
            </div>
          )}
          <div className="mt-4 text-xs text-slate-500">
            Last updated {formatDate(inquiry.updatedAt)}
          </div>
        </div>

        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Contact</div>
          <div className="text-sm">
            <span className="text-slate-500">Email:</span>{" "}
            {inquiry.email ? (
              <a href={`mailto:${inquiry.email}`} className="text-blue-600 hover:underline">
                {inquiry.email}
              </a>
            ) : (
              "—"
            )}
          </div>
          <div className="text-sm mt-1">
            <span className="text-slate-500">Phone:</span>{" "}
            {inquiry.phone ? (
              <a href={`tel:${inquiry.phone}`} className="text-blue-600 hover:underline">
                {inquiry.phone}
              </a>
            ) : (
              "—"
            )}
          </div>
          <div className="text-sm mt-1">
            <span className="text-slate-500">Source:</span>{" "}
            {sourceLabels[inquiry.source] ?? inquiry.source}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">
            Interested in
          </div>
          {inquiry.unit ? (
            <div className="text-sm">
              <Link
                href={`/properties/${inquiry.unit.property.id}`}
                className="hover:underline font-medium"
              >
                {inquiry.unit.property.name}
              </Link>{" "}
              · Unit {inquiry.unit.label}
              <div className="text-xs text-slate-500 mt-1">
                Occupancy: {inquiry.unit.occupancyStatus}
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">No unit linked.</div>
          )}
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Message</div>
          <p className="text-sm whitespace-pre-wrap">
            {inquiry.message ?? (
              <span className="text-slate-400">No message provided.</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
