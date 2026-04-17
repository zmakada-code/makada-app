"use client";

import { GlobalSearch } from "@/components/GlobalSearch";
import { Bell } from "lucide-react";

export function TopBar() {
  return (
    <header className="h-14 border-b border-slate-200/80 bg-white/80 backdrop-blur-sm flex items-center px-6 gap-4 sticky top-0 z-10">
      <GlobalSearch />
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="relative h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>
        <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-[11px] font-bold text-white">
          NM
        </div>
      </div>
    </header>
  );
}
