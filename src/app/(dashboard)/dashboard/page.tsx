import Link from "next/link";
import { Building2, DoorOpen, Users, FileText, Wrench, Inbox } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { Flash } from "@/components/Flash";
import { LeaseStatusBadge } from "@/components/LeaseStatusBadge";
import { TicketStatusBadge } from "@/components/TicketStatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { InquiryStatusBadge } from "@/components/InquiryStatusBadge";
import { formatDate, daysUntil } from "@/lib/dates";

export const dynamic = "force-dynamic";

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href?: string;
}) {
  const body = (
    <div className="card p-5 h-full">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:opacity-90 transition">
      {body}
    </Link>
  ) : (
    body
  );
}

export default async function DashboardPage() {
  const now = new Date();
  const in60 = new Date();
  in60.setDate(in60.getDate() + 60);
  const last30 = new Date();
  last30.setDate(last30.getDate() - 30);

  const [
    propertyCount,
    unitCount,
    occupiedCount,
    vacantCount,
    tenantCount,
    activeLeaseCount,
    endingSoonCount,
    endingSoonLeases,
    openTicketCount,
    inProgressTicketCount,
    recentTickets,
    newInquiryCount,
    recentInquiries,
    vacantUnitsWithInquiries,
  ] = await Promise.all([
    prisma.property.count(),
    prisma.unit.count(),
    prisma.unit.count({ where: { occupancyStatus: "OCCUPIED" } }),
    prisma.unit.count({ where: { occupancyStatus: "VACANT" } }),
    prisma.tenant.count(),
    prisma.lease.count({ where: { status: "ACTIVE" } }),
    prisma.lease.count({
      where: { status: "ACTIVE", endDate: { gte: now, lte: in60 } },
    }),
    prisma.lease.findMany({
      where: { status: "ACTIVE", endDate: { gte: now, lte: in60 } },
      orderBy: { endDate: "asc" },
      take: 5,
      include: {
        tenant: { select: { id: true, fullName: true } },
        unit: {
          select: {
            label: true,
            property: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.maintenanceTicket.count({ where: { status: "OPEN" } }),
    prisma.maintenanceTicket.count({ where: { status: "IN_PROGRESS" } }),
    prisma.maintenanceTicket.findMany({
      where: { status: { not: "RESOLVED" } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        unit: {
          select: {
            label: true,
            property: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.inquiry.count({ where: { status: "NEW" } }),
    prisma.inquiry.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        unit: {
          select: {
            label: true,
            property: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.unit.findMany({
      where: {
        occupancyStatus: { in: ["VACANT", "TURNOVER"] },
        inquiries: { some: { createdAt: { gte: last30 } } },
      },
      orderBy: [{ property: { name: "asc" } }, { label: "asc" }],
      take: 6,
      select: {
        id: true,
        label: true,
        property: { select: { id: true, name: true } },
        _count: {
          select: {
            inquiries: { where: { status: { notIn: ["CONVERTED", "REJECTED"] } } },
          },
        },
      },
    }),
  ]);

  return (
    <div>
      <Flash />
      <PageHeader title="Dashboard" description="Overview of the portfolio." />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Stat label="Properties" value={propertyCount} href="/properties" />
        <Stat label="Units" value={unitCount} href="/units" />
        <Stat label="Occupied" value={occupiedCount} href="/units?status=OCCUPIED" />
        <Stat label="Vacant" value={vacantCount} href="/units?status=VACANT" />
        <Stat label="Tenants" value={tenantCount} href="/tenants" />
        <Stat label="Active leases" value={activeLeaseCount} href="/leases?status=ACTIVE" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
        <Stat
          label="Leases ending in 60 days"
          value={endingSoonCount}
          href="/leases?status=ending_soon"
        />
        <Stat
          label="Open maintenance"
          value={openTicketCount}
          href="/maintenance?status=OPEN"
        />
        <Stat
          label="In-progress maintenance"
          value={inProgressTicketCount}
          href="/maintenance?status=IN_PROGRESS"
        />
        <Stat
          label="New inquiries"
          value={newInquiryCount}
          href="/inquiries?status=NEW"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4 text-slate-500" /> Ending soon
            </div>
            <Link
              href="/leases?status=ending_soon"
              className="text-xs text-slate-500 hover:text-slate-900"
            >
              View all →
            </Link>
          </div>
          {endingSoonLeases.length === 0 ? (
            <p className="text-sm text-slate-500">No active leases ending in the next 60 days.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {endingSoonLeases.map((l) => {
                const days = daysUntil(l.endDate);
                return (
                  <li key={l.id} className="py-2.5 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        <Link href={`/tenants/${l.tenant.id}`} className="hover:underline">
                          {l.tenant.fullName}
                        </Link>{" "}
                        · {l.unit.property.name} · {l.unit.label}
                      </div>
                      <div className="text-xs text-slate-500">
                        Ends {formatDate(l.endDate)}
                        {days >= 0 && ` (in ${days} day${days === 1 ? "" : "s"})`}
                      </div>
                    </div>
                    <LeaseStatusBadge status={l.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Wrench className="h-4 w-4 text-slate-500" /> Recent maintenance
            </div>
            <Link
              href="/maintenance"
              className="text-xs text-slate-500 hover:text-slate-900"
            >
              View all →
            </Link>
          </div>
          {recentTickets.length === 0 ? (
            <p className="text-sm text-slate-500">No open or in-progress tickets.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentTickets.map((t) => (
                <li key={t.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      <Link href={`/maintenance/${t.id}`} className="hover:underline">
                        {t.title}
                      </Link>
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {t.unit.property.name} · {t.unit.label} · updated {formatDate(t.updatedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <PriorityBadge priority={t.priority} />
                    <TicketStatusBadge status={t.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Inbox className="h-4 w-4 text-slate-500" /> Recent inquiries
            </div>
            <Link
              href="/inquiries"
              className="text-xs text-slate-500 hover:text-slate-900"
            >
              View all →
            </Link>
          </div>
          {recentInquiries.length === 0 ? (
            <p className="text-sm text-slate-500">No inquiries yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentInquiries.map((i) => (
                <li key={i.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      <Link href={`/inquiries/${i.id}`} className="hover:underline">
                        {i.prospectName}
                      </Link>
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {i.unit
                        ? `${i.unit.property.name} · ${i.unit.label}`
                        : "No unit"}
                      {" · updated "}
                      {formatDate(i.updatedAt)}
                    </div>
                  </div>
                  <InquiryStatusBadge status={i.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <DoorOpen className="h-4 w-4 text-slate-500" /> Vacant units with recent interest
            </div>
            <Link
              href="/units?status=VACANT"
              className="text-xs text-slate-500 hover:text-slate-900"
            >
              All vacant →
            </Link>
          </div>
          {vacantUnitsWithInquiries.length === 0 ? (
            <p className="text-sm text-slate-500">
              No vacant units with inquiries in the last 30 days.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {vacantUnitsWithInquiries.map((u) => (
                <li key={u.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      <Link
                        href={`/properties/${u.property.id}`}
                        className="hover:underline"
                      >
                        {u.property.name}
                      </Link>{" "}
                      · {u.label}
                    </div>
                    <div className="text-xs text-slate-500">
                      {u._count.inquiries} active inquir
                      {u._count.inquiries === 1 ? "y" : "ies"}
                    </div>
                  </div>
                  <Link
                    href={`/inquiries/new?unitId=${u.id}`}
                    className="text-xs text-slate-500 hover:text-slate-900"
                  >
                    Log inquiry →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card p-5 mt-6">
        <div className="text-sm font-medium mb-3">Quick actions</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            href="/properties/new"
            className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          >
            <Building2 className="h-4 w-4 text-slate-500" /> Add property
          </Link>
          <Link
            href="/tenants/new"
            className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          >
            <Users className="h-4 w-4 text-slate-500" /> Add tenant
          </Link>
          <Link
            href="/inquiries/new"
            className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          >
            <Inbox className="h-4 w-4 text-slate-500" /> New inquiry
          </Link>
          <Link
            href="/maintenance/new"
            className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          >
            <Wrench className="h-4 w-4 text-slate-500" /> New ticket
          </Link>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-slate-600">
          <Link href="/properties" className="flex items-center gap-2 hover:text-slate-900">
            <Building2 className="h-4 w-4" /> Properties
          </Link>
          <Link href="/units" className="flex items-center gap-2 hover:text-slate-900">
            <DoorOpen className="h-4 w-4" /> Units
          </Link>
          <Link href="/tenants" className="flex items-center gap-2 hover:text-slate-900">
            <Users className="h-4 w-4" /> Tenants
          </Link>
          <Link href="/leases" className="flex items-center gap-2 hover:text-slate-900">
            <FileText className="h-4 w-4" /> Leases
          </Link>
          <Link href="/maintenance" className="flex items-center gap-2 hover:text-slate-900">
            <Wrench className="h-4 w-4" /> Maintenance
          </Link>
          <Link href="/documents" className="flex items-center gap-2 hover:text-slate-900">
            <FileText className="h-4 w-4" /> Documents
          </Link>
          <Link href="/inquiries" className="flex items-center gap-2 hover:text-slate-900">
            <Inbox className="h-4 w-4" /> Inquiries
          </Link>
        </div>
      </div>
    </div>
  );
}
