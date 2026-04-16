"use client";

import { GlobalSearch } from "@/components/GlobalSearch";

export function TopBar() {
  return (
    <header className="h-14 border-b border-slate-200 bg-white flex items-center px-5 gap-4 sticky top-0 z-10">
      <GlobalSearch />
    </header>
  );
}
