"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Reads ?flash=... from the URL, shows it briefly, then cleans the URL.
 * Server actions append the flash param via redirect().
 */
export function Flash() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const message = params.get("flash");
  const type = params.get("flashType") ?? "success";

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete("flash");
      url.searchParams.delete("flashType");
      router.replace(url.pathname + url.search);
    }, 4000);
    return () => clearTimeout(t);
  }, [message, router, pathname]);

  if (!message) return null;
  const isError = type === "error";
  return (
    <div
      className={
        "mb-4 rounded-md border px-3 py-2 text-sm " +
        (isError
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700")
      }
    >
      {message}
    </div>
  );
}
