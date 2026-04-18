"use client";

import { useState } from "react";
import { Send, Loader2, Check, Clock, FileCheck, Download } from "lucide-react";

const STATUS_DISPLAY: Record<string, { label: string; icon: typeof Check; className: string }> = {
  PENDING_SIGNATURE: {
    label: "Awaiting signature",
    icon: Clock,
    className: "text-amber-700 bg-amber-50 border-amber-200",
  },
  SIGNED: {
    label: "Signed",
    icon: FileCheck,
    className: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
};

export function SendForSigningButton({
  leaseId,
  signingStatus,
}: {
  leaseId: string;
  signingStatus: string | null;
}) {
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(signingStatus);
  const [error, setError] = useState("");

  if (status && STATUS_DISPLAY[status]) {
    const display = STATUS_DISPLAY[status];
    const Icon = display.icon;
    return (
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${display.className}`}
        >
          <Icon className="h-3 w-3" />
          {display.label}
        </span>
        {/* Download link for lease PDF */}
        <a
          href={`/api/leases/${leaseId}/download?type=${status === "SIGNED" ? "signed" : "unsigned"}`}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          title={`Download ${status === "SIGNED" ? "signed" : "unsigned"} lease PDF`}
        >
          <Download className="h-3 w-3" />
          PDF
        </a>
      </div>
    );
  }

  async function handleSend() {
    if (!confirm("Send this lease to the tenant for signing?")) return;
    setSending(true);
    setError("");

    try {
      const res = await fetch(`/api/leases/${leaseId}/send-for-signing`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send");
      }

      setStatus("PENDING_SIGNATURE");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-1">
      <button
        onClick={handleSend}
        disabled={sending}
        className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
        title="Send lease to tenant for signing"
      >
        {sending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
        Send for signing
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
