"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  DoorOpen,
  Users,
  FileText,
  Wrench,
  FolderOpen,
  Inbox,
  Settings,
  CreditCard,
  Home,
} from "lucide-react";
import clsx from "clsx";

const MAIN_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/units", label: "Units", icon: DoorOpen },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
];

const PEOPLE_NAV = [
  { href: "/tenants", label: "Tenants", icon: Users },
  { href: "/leases", label: "Leases", icon: FileText },
  { href: "/inquiries", label: "Inquiries", icon: Inbox },
];

const MANAGE_NAV = [
  { href: "/documents", label: "Documents", icon: FolderOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavSection({
  label,
  items,
  pathname,
}: {
  label?: string;
  items: { href: string; label: string; icon: React.ElementType }[];
  pathname: string;
}) {
  return (
    <div className="mb-2">
      {label && (
        <div className="px-3 pt-4 pb-1.5 text-[10px] uppercase tracking-widest text-indigo-300/50 font-semibold">
          {label}
        </div>
      )}
      <div className="space-y-0.5">
        {items.map(({ href, label: navLabel, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150",
                active
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-indigo-100/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className={clsx("h-4 w-4", active ? "text-white" : "text-indigo-300/60")} />
              <span>{navLabel}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-[220px] shrink-0 bg-gradient-to-b from-[#1e1b4b] to-[#1a1744] h-screen sticky top-0 flex flex-col">
      {/* Brand */}
      <div className="px-4 py-5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-500/30 flex items-center justify-center">
            <Home className="h-4 w-4 text-indigo-300" />
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-tight">Makada</div>
            <div className="text-[10px] text-indigo-300/50 font-medium">Properties</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 overflow-y-auto">
        <NavSection items={MAIN_NAV} pathname={pathname} />
        <NavSection label="Renters" items={PEOPLE_NAV} pathname={pathname} />
        <NavSection label="Manage" items={MANAGE_NAV} pathname={pathname} />
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 text-[10px] text-indigo-300/30 border-t border-white/5">
        Makada Properties v0.1
      </div>
    </aside>
  );
}
