"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";

/**
 * Property photo with graceful fallback to a placeholder
 * when the image fails to load (e.g. expired signed URL, missing file).
 */
export function PropertyPhoto({
  url,
  name,
  height = "h-36",
}: {
  url: string | null;
  name: string;
  height?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <div
        className={`${height} bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center`}
      >
        <Building2 className="h-10 w-10 text-slate-300" />
      </div>
    );
  }

  return (
    <div className={`${height} bg-slate-100`}>
      <img
        src={url}
        alt={name}
        className="w-full h-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
