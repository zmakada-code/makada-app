"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Building2, DoorOpen, Users, Inbox } from "lucide-react";
import clsx from "clsx";

type Hit = {
  kind: "tenant" | "property" | "unit" | "inquiry";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

const ICONS = {
  tenant: Users,
  property: Building2,
  unit: DoorOpen,
  inquiry: Inbox,
} as const;

const LABELS: Record<Hit["kind"], string> = {
  tenant: "Tenant",
  property: "Property",
  unit: "Unit",
  inquiry: "Inquiry",
};

export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Global hotkey: "/" focuses search (unless already typing in an input).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (e.key === "/" && tag !== "input" && tag !== "textarea" && tag !== "select") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Debounced fetch.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(term)}`,
          { signal: ctrl.signal, cache: "no-store" }
        );
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as { hits: Hit[] };
        setHits(data.hits);
        setActive(0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setHits([]);
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q]);

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const hit = hits[active];
      if (hit) {
        e.preventDefault();
        go(hit.href);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const showDropdown = open && q.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative flex-1 max-w-xl">
      <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search tenants, properties, units, inquiries…  (press / )"
        className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-300 transition-colors"
      />

      {showDropdown && (
        <div className="absolute left-0 right-0 mt-1 rounded-md border border-slate-200 bg-white shadow-lg z-20 max-h-96 overflow-auto">
          {loading && (
            <div className="px-3 py-2 text-xs text-slate-500">Searching…</div>
          )}
          {!loading && hits.length === 0 && (
            <div className="px-3 py-3 text-xs text-slate-500">No matches.</div>
          )}
          {!loading && hits.length > 0 && (
            <ul>
              {hits.map((h, i) => {
                const Icon = ICONS[h.kind];
                return (
                  <li key={`${h.kind}-${h.id}`}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(h.href)}
                      className={clsx(
                        "w-full text-left px-3 py-2 flex items-center gap-3 text-sm",
                        i === active ? "bg-slate-50" : "hover:bg-slate-50"
                      )}
                    >
                      <Icon className="h-4 w-4 text-slate-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{h.title}</div>
                        {h.subtitle && (
                          <div className="text-xs text-slate-500 truncate">
                            {h.subtitle}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] uppercase tracking-wide text-slate-400 shrink-0">
                        {LABELS[h.kind]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
