"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { GlobalSearch } from "@/components/GlobalSearch";

export function TopBar({ userEmail }: { userEmail?: string | null }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="h-14 border-b border-slate-200 bg-white flex items-center px-5 gap-4 sticky top-0 z-10">
      <GlobalSearch />
      <div className="flex items-center gap-3 text-sm">
        {userEmail && <span className="text-slate-500 hidden sm:inline">{userEmail}</span>}
        <button
          onClick={signOut}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
