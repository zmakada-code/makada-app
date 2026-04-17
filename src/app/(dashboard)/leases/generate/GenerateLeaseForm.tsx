"use client";

import { useState, useEffect } from "react";
import { FileText, Loader2, Download, Save } from "lucide-react";

type LeaseInput = {
  TENANT_1_NAME: string;
  TENANT_2_NAME: string;
  PROPERTY_ADDRESS: string;
  UNIT_NUMBER: string;
  BEDROOM_COUNT: string;
  BATHROOM_COUNT: string;
  RENT_AMOUNT: string;
  SECURITY_DEPOSIT: string;
  START_DATE: string;
  END_DATE: string;
  EFFECTIVE_DATE: string;
  PARKING_SPACE: string;
  STORAGE_DESCRIPTION: string;
  TENANT_1_INITIALS: string;
  TENANT_2_INITIALS: string;
  TENANT_1_SIGN_DATE: string;
  TENANT_2_SIGN_DATE: string;
};

const FIELD_LABELS: Record<keyof LeaseInput, string> = {
  TENANT_1_NAME: "Tenant 1 Full Name",
  TENANT_2_NAME: "Tenant 2 Full Name (optional)",
  PROPERTY_ADDRESS: "Property Address",
  UNIT_NUMBER: "Unit Number / Label",
  BEDROOM_COUNT: "Bedrooms",
  BATHROOM_COUNT: "Bathrooms",
  RENT_AMOUNT: "Monthly Rent",
  SECURITY_DEPOSIT: "Security Deposit",
  START_DATE: "Lease Start Date",
  END_DATE: "Lease End Date",
  EFFECTIVE_DATE: "Effective Date",
  PARKING_SPACE: "Parking Description",
  STORAGE_DESCRIPTION: "Storage Description",
  TENANT_1_INITIALS: "Tenant 1 Initials",
  TENANT_2_INITIALS: "Tenant 2 Initials (optional)",
  TENANT_1_SIGN_DATE: "Tenant 1 Sign Date",
  TENANT_2_SIGN_DATE: "Tenant 2 Sign Date",
};

const FIELD_ORDER: (keyof LeaseInput)[] = [
  "TENANT_1_NAME",
  "TENANT_2_NAME",
  "PROPERTY_ADDRESS",
  "UNIT_NUMBER",
  "BEDROOM_COUNT",
  "BATHROOM_COUNT",
  "RENT_AMOUNT",
  "SECURITY_DEPOSIT",
  "START_DATE",
  "END_DATE",
  "EFFECTIVE_DATE",
  "PARKING_SPACE",
  "STORAGE_DESCRIPTION",
  "TENANT_1_INITIALS",
  "TENANT_2_INITIALS",
  "TENANT_1_SIGN_DATE",
  "TENANT_2_SIGN_DATE",
];

const EMPTY_INPUT: LeaseInput = Object.fromEntries(
  FIELD_ORDER.map((k) => [k, ""])
) as LeaseInput;

export function GenerateLeaseForm({ leaseId }: { leaseId?: string }) {
  const [fields, setFields] = useState<LeaseInput>(EMPTY_INPUT);
  const [loading, setLoading] = useState(!!leaseId);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Auto-fill from lease if provided
  useEffect(() => {
    if (!leaseId) return;
    fetch(`/api/leases/generate?leaseId=${leaseId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setMessage(`Error: ${data.error}`);
        } else {
          setFields(data);
        }
      })
      .catch(() => setMessage("Failed to load lease data."))
      .finally(() => setLoading(false));
  }, [leaseId]);

  function update(key: keyof LeaseInput, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleGenerate(andSave: boolean) {
    const setter = andSave ? setSaving : setGenerating;
    setter(true);
    setMessage(null);

    try {
      const saveParam = andSave && leaseId ? "?save=true" : "";
      const res = await fetch(`/api/leases/generate${saveParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          leaseId ? { leaseId, overrides: fields } : { data: fields }
        ),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage(err.error || "Generation failed");
        return;
      }

      // Download
      const blob = await res.blob();
      const filename =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ||
        "lease.docx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      if (andSave) {
        setMessage("Lease generated and saved to documents.");
      }
    } catch {
      setMessage("Failed to generate lease.");
    } finally {
      setter(false);
    }
  }

  if (loading) {
    return (
      <div className="card p-8 flex items-center justify-center gap-2 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading lease data...
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="card p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FIELD_ORDER.map((key) => (
            <div key={key} className={key === "PROPERTY_ADDRESS" ? "md:col-span-2" : ""}>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {FIELD_LABELS[key]}
              </label>
              <input
                type="text"
                value={fields[key]}
                onChange={(e) => update(key, e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder={FIELD_LABELS[key]}
              />
            </div>
          ))}
        </div>

        {message && (
          <div
            className={`rounded-md px-4 py-2 text-sm ${
              message.startsWith("Error")
                ? "bg-red-50 text-red-700"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {message}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => handleGenerate(false)}
            disabled={generating || saving}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download Lease
          </button>

          {leaseId && (
            <button
              onClick={() => handleGenerate(true)}
              disabled={generating || saving}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Download &amp; Save to Documents
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
