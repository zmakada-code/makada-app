"use client";

import { useState, useRef } from "react";
import { Send, Loader2, Clock, FileCheck, Download, XCircle, Mail, Upload, FileText, X } from "lucide-react";

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

export type LeaseDetails = {
  startDate: string;
  endDate: string;
  monthlyRent: string;
  securityDeposit: string;
};

export function SendForSigningButton({
  leaseId,
  signingStatus,
  tenantEmail,
  leaseDetails,
}: {
  leaseId: string;
  signingStatus: string | null;
  tenantEmail?: string | null;
  leaseDetails?: LeaseDetails;
}) {
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [status, setStatus] = useState(signingStatus);
  const [error, setError] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailInput, setEmailInput] = useState(tenantEmail || "");

  // Editable lease fields
  const [startDate, setStartDate] = useState(leaseDetails?.startDate || "");
  const [endDate, setEndDate] = useState(leaseDetails?.endDate || "");
  const [monthlyRent, setMonthlyRent] = useState(leaseDetails?.monthlyRent || "");
  const [securityDeposit, setSecurityDeposit] = useState(leaseDetails?.securityDeposit || "");

  // File upload
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          title="Void this lease signing"
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
      // If a file is uploaded, use the document upload endpoint
      if (uploadedFile) {
        const formData = new FormData();
        formData.append("file", uploadedFile);
        formData.append("email", emailInput.trim());

        const res = await fetch(`/api/leases/${leaseId}/send-with-document`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to send");
        }

        setStatus("PENDING_SIGNATURE");
        setShowEmailForm(false);
        return;
      }

      // No file uploaded — use auto-generated PDF flow
      // First save any lease field edits
      if (startDate || endDate || monthlyRent || securityDeposit) {
        const updateRes = await fetch(`/api/leases/${leaseId}/update-fields`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            monthlyRent: monthlyRent || undefined,
            securityDeposit: securityDeposit || undefined,
          }),
        });
        if (!updateRes.ok) {
          const data = await updateRes.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update lease fields");
        }
      }

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
      setShowEmailForm(false);
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

      setStatus(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCancelling(false);
    }
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndSetFile(file);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) validateAndSetFile(file);
  }

  function validateAndSetFile(file: File) {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".docx") && !name.endsWith(".doc") && !name.endsWith(".pdf")) {
      setError("Please upload a .docx or .pdf file");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError("File is too large (max 25MB)");
      return;
    }
    setError("");
    setUploadedFile(file);
  }

  if (showEmailForm) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm space-y-2 min-w-[300px]">
        <div className="text-xs font-medium text-slate-700 mb-1">Send lease for signing</div>

        {/* File upload area */}
        <div>
          <label className="text-[10px] uppercase tracking-wide text-slate-500">
            Lease document (optional — drop .docx or .pdf)
          </label>
          {uploadedFile ? (
            <div className="flex items-center gap-2 rounded border border-indigo-200 bg-indigo-50 px-2 py-1.5 text-xs mt-0.5">
              <FileText className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
              <span className="text-indigo-700 truncate flex-1">{uploadedFile.name}</span>
              <button
                onClick={() => { setUploadedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                className="text-indigo-400 hover:text-indigo-600"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`mt-0.5 flex items-center justify-center gap-1.5 rounded border-2 border-dashed px-3 py-3 text-xs cursor-pointer transition ${
                dragOver
                  ? "border-indigo-400 bg-indigo-50 text-indigo-600"
                  : "border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500"
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Drop lease file here or click to browse</span>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.doc,.pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Divider with "or" text */}
        {!uploadedFile && (
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <div className="flex-1 border-t border-slate-200" />
            <span>or auto-generate from lease details</span>
            <div className="flex-1 border-t border-slate-200" />
          </div>
        )}

        {/* Only show editable fields when no file is uploaded */}
        {!uploadedFile && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-wide text-slate-500">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-slate-500">End date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-slate-500">Monthly rent</label>
              <input
                type="number"
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(e.target.value)}
                className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                step="0.01"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-slate-500">Security deposit</label>
              <input
                type="number"
                value={securityDeposit}
                onChange={(e) => setSecurityDeposit(e.target.value)}
                className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                step="0.01"
              />
            </div>
          </div>
        )}

        <div>
          <label className="text-[10px] uppercase tracking-wide text-slate-500">Send to email</label>
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="tenant@email.com"
            className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
            onKeyDown={(e) => e.key === "Enter" && handleSendViaEmail()}
          />
        </div>

        {error && <div className="text-xs text-red-600">{error}</div>}

        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => { setShowEmailForm(false); setUploadedFile(null); setError(""); }}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSendViaEmail}
            disabled={sending}
            className="inline-flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            {uploadedFile ? "Upload & send" : "Send lease"}
          </button>
        </div>
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
        onClick={() => setShowEmailForm(true)}
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
