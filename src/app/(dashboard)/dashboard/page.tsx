import Link from "next/link";
import { Building2, DoorOpen, Users, FileText, Wrench, Inbox, CreditCard, Plus, ArrowRight } from "lucide-react";
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
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  href?: string;
  icon?: React.ElementType;
  accent?: string;
}) {
  const body = (
    <div className="card p-5 h-full group">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
          <div className="text-2xl font-bold mt-1.5 text-slate-900">{value}</div>
        </div>
        {Icon && (
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${accent || "bg-slate-100"}`}>
            <Icon className="h-5 w-5 text-inherit" />
          </div>
        )}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:scale-[1.01] transition-transform">
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

      {/* Primary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Stat label="Properties" value={propertyCount} href="/properties" icon={Building2} accent="bg-indigo-50 text-indigo-600" />
        <Stat label="Units" value={unitCount} href="/units" icon={DoorOpen} accent="bg-blue-50 text-blue-600" />
        <Stat label="Occupied" value={occupiedCount} href="/units?status=OCCUPIED" icon={Users} accent="bg-emerald-50 text-emerald-600" />
        <Stat label="Vacant" value={vacantCount} href="/units?status=VACANT" icon={DoorOpen} accent="bg-amber-50 text-amber-600" />
        <Stat label="Tenants" value={tenantCount} href="/tenants" icon={Users} accent="bg-violet-50 text-violet-600" />
        <Stat label="Active leases" value={activeLeaseCount} href="/leases?status=ACTIVE" icon={FileText} accent="bg-sky-50 text-sky-600" />
      </div>

      {/* Alert Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
        <Stat label="Leases ending in 60 days" value={endingSoonCount} href="/leases?status=ending_soon" />
        <Stat label="Open maintenance" value={openTicketCount} href="/maintenance?status=OPEN" />
        <Stat label="In-progress maintenance" value={inProgressTicketCount} href="/maintenance?status=IN_PROGRESS" />
        <Stat label="New inquiries" value={newInquiryCount} href="/inquiries?status=NEW" />
      </div>

      {/* Detail Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        {/* Ending Soon */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FileText className="h-4 w-4 text-indigo-500" /> Ending soon
            </div>
            <Link href="/leases?status=ending_soon" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {endingSoonLeases.length === 0 ? (
            <p className="text-sm text-slate-400">No active leases ending in the next 60 days.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {endingSoonLeases.map((l) => {
                const days = daysUntil(l.endDate);
                return (
                  <li key={l.id} className="py-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        <Link href={`/tenants/${l.tenant.id}`} className="hover:text-indigo-600 transition-colors">
                          {l.tenant.fullName}
                        </Link>{" "}
                        <span className="text-slate-400">·</span> {l.unit.property.name} <span className="text-slate-400">·</span> {l.unit.label}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Ends {formatDate(l.endDate)}
                        {days >= 0 && ` (in ${days} day${days === 1 ? "" : "s"})`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/leases/generate?leaseId=${l.id}`}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        Renew
                      </Link>
                      <LeaseStatusBadge status={l.status} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Maintenance */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Wrench className="h-4 w-4 text-indigo-500" /> Recent maintenance
            </div>
            <Link href="/maintenance" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentTickets.length === 0 ? (
            <p className="text-sm text-slate-400">No open or in-progress tickets.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentTickets.map((t) => (
                <li key={t.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      <Link href={`/maintenance/${t.id}`} className="hover:text-indigo-600 transition-colors">
                        {t.title}
                      </Link>
                    </div>
                    <div className="text-xs text-slate-400 truncate mt-0.5">
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
        {/* Inquiries */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Inbox className="h-4 w-4 text-indigo-500" /> Recent inquiries
            </div>
            <Link href="/inquiries" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentInquiries.length === 0 ? (
            <p className="text-sm text-slate-400">No inquiries yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentInquiries.map((i) => (
                <li key={i.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      <Link href={`/inquiries/${i.id}`} className="hover:text-indigo-600 transition-colors">
                        {i.prospectName}
                      </Link>
                    </div>
                    <div className="text-xs text-slate-400 truncate mt-0.5">
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

        {/* Vacant with Interest */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <DoorOpen className="h-4 w-4 text-indigo-500" /> Vacant units with recent interest
            </div>
            <Link href="/units?status=VACANT" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
              All vacant <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {vacantUnitsWithInquiries.length === 0 ? (
            <p className="text-sm text-slate-400">
              No vacant units with inquiries in the last 30 days.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {vacantUnitsWithInquiries.map((u) => (
                <li key={u.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      <Link
                        href={`/properties/${u.property.id}`}
                        className="hover:text-indigo-600 transition-colors"
                      >
                        {u.property.name}
                      </Link>{" "}
                      <span className="text-slate-400">·</span> {u.label}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {u._count.inquiries} active inquir
                      {u._count.inquiries === 1 ? "y" : "ies"}
                    </div>
                  </div>
                  <Link
                    href={`/inquiries/new?unitId=${u.id}`}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Log inquiry
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-5 mt-6">
        <div className="text-sm font-semibold text-slate-900 mb-4">Quick actions</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            href="/properties/new"
            className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4 text-slate-400" /> Add property
          </Link>
          <Link
            href="/tenants/new"
            className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4 text-slate-400" /> Add tenant
          </Link>
          <Link
            href="/inquiries/new"
            className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4 text-slate-400" /> New inquiry
          </Link>
          <Link
            href="/maintenance/new"
            className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4 text-slate-400" /> New ticket
          </Link>
        </div>
      </div>
    </div>
  );
}
