"use client";

import { useState } from "react";
import { Send, Loader2, Clock, FileCheck, Download, XCircle, Mail } from "lucide-react";

const STATUS_DISPLAY: Record<
  string,
  { label: string; icon: typeof FileCheck; className: string }
> = {
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
  tenantEmail,
}: {
  leaseId: string;
  signingStatus: string | null;
  tenantEmail?: string | null;
}) {
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [status, setStatus] = useState(signingStatus);
  const [error, setError] = useState("");
  const [voided, setVoided] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [emailInput, setEmailInput] = useState(tenantEmail || "");

  // After cancelling, reset so the send buttons show again
  // (voided no longer used — cancel just resets signing status)

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
        <a
          href={`/api/leases/${leaseId}/download?type=${status === "SIGNED" ? "signed" : "unsigned"}`}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          title={`Download ${status === "SIGNED" ? "signed" : "unsigned"} lease PDF`}
        >
          <Download className="h-3 w-3" />
          PDF
        </a>
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
          title="Void this lease"
        >
          {cancelling ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
          Void
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  async function handleSend() {
    if (!confirm("Send this lease to the tenant for signing via their portal?")) return;
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

  async function handleSendViaEmail() {
    if (!emailInput.trim()) {
      setError("Enter an email address");
      return;
    }
    setSending(true);
    setError("");

    try {
      const res = await fetch(`/api/leases/${leaseId}/send-via-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send");
      }

      setStatus("PENDING_SIGNATURE");
      setShowEmailInput(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function handleCancel() {
    if (
      !confirm(
        "Cancel this lease signing? The lease will stay active but the signing will reset so you can re-send it."
      )
    )
      return;

    setCancelling(true);
    setError("");

    try {
      const res = await fetch(`/api/leases/${leaseId}/cancel`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to cancel");
      }

      // Reset status so the send buttons show again
      setStatus(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCancelling(false);
    }
  }

  if (showEmailInput) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="email"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder="tenant@email.com"
          className="w-44 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          onKeyDown={(e) => e.key === "Enter" && handleSendViaEmail()}
        />
        <button
          onClick={handleSendViaEmail}
          disabled={sending}
          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          Send
        </button>
        <button
          onClick={() => setShowEmailInput(false)}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={handleSend}
        disabled={sending}
        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
        title="Send to tenant portal"
      >
        {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
        Portal
      </button>
      <button
        onClick={() => setShowEmailInput(true)}
        className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800"
        title="Send signing link via email"
      >
        <Mail className="h-3 w-3" />
        Email
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
