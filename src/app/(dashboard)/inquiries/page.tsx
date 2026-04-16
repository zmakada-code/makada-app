import Link from "next/link";
import { Plus, Inbox } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { Flash } from "@/components/Flash";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/EmptyState";
import { InlineInquiryStatus } from "@/components/InlineInquiryStatus";
import { setInquiryStatus } from "@/lib/actions/inquiries";
import { formatDate } from "@/lib/dates";
import type { InquiryStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const FILTERS: { key: "ALL" | InquiryStatus; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "NEW", label: "New" },
  { key: "CONTACTED", label: "Contacted" },
  { key: "TOURED", label: "Toured" },
  { key: "REJECTED", label: "Rejected" },
  { key: "CONVERTED", label: "Converted" },
];

export default async function InquiriesListPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const active = (searchParams.status ?? "ALL") as "ALL" | InquiryStatus;
  const where =
    active !== "ALL" && FILTERS.some((f) => f.key === active)
      ? { status: active as InquiryStatus }
      : {};

  const inquiries = await prisma.inquiry.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      unit: {
        select: {
          id: true,
          label: true,
          property: { select: { id: true, name: true } },
        },
      },
    },
  });

  return (
    <div>
      <Flash />
      <PageHeader
        title="Inquiries"
        description="Incoming leads from the public site, walk-ins, and referrals."
        action={
          <ButtonLink href="/inquiries/new">
            <Plus className="h-4 w-4" /> New inquiry
          </ButtonLink>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const isActive = active === f.key;
          const href = f.key === "ALL" ? "/inquiries" : `/inquiries?status=${f.key}`;
          return (
            <Link
              key={f.key}
              href={href}
              className={
                isActive
                  ? "inline-flex items-center rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-xs font-medium text-white"
                  : "inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900"
              }
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {inquiries.length === 0 ? (
        active === "ALL" ? (
          <EmptyState
            icon={Inbox}
            title="No inquiries yet"
            description="Log a walk-in or referral manually, or connect the public website intake so new leads land here automatically."
            actionLabel="Log an inquiry"
            actionHref="/inquiries/new"
            hint="The Replit site can POST to /api/inquiries with a shared secret."
          />
        ) : (
          <div className="card p-8 text-center text-sm text-slate-500">
            No inquiries match this filter.
          </div>
        )
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-2">Prospect</th>
                <th className="text-left px-4 py-2">Unit</th>
                <th className="text-left px-4 py-2">Contact</th>
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
                    {i.unit ? (
                      <Link
                        href={`/properties/${i.unit.property.id}`}
                        className="hover:underline"
                      >
                        {i.unit.property.name} · {i.unit.label}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {i.email ?? i.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{i.source}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(i.createdAt)}</td>
                  <td className="px-4 py-3">
                    <InlineInquiryStatus
                      id={i.id}
                      status={i.status}
                      action={async (fd) => {
                        "use server";
                        await setInquiryStatus(fd);
                      }}
                    />
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
    </div>
  );
}
