"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

type LeaseOption = {
  id: string;
  label: string;
  rent: number;
};

export function LogPaymentForm({ leases }: { leases: LeaseOption[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Default to current month
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const body = {
      leaseId: fd.get("leaseId"),
      period: fd.get("period"),
      method: fd.get("method"),
      amountPaid: fd.get("amountPaid") ? Number(fd.get("amountPaid")) : null,
      note: fd.get("note") || null,
    };

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to log payment");
      }

      router.push("/payments?logged=true");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300 transition-colors";

  const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="leaseId" className={labelClass}>
          Tenant / Lease
        </label>
        <select id="leaseId" name="leaseId" required className={inputClass}>
          <option value="">Select a tenant…</option>
          {leases.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label} (${l.rent.toLocaleString()}/mo)
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="period" className={labelClass}>
          Period
        </label>
        <input
          id="period"
          name="period"
          type="month"
          required
          defaultValue={defaultPeriod}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="method" className={labelClass}>
          Payment method
        </label>
        <select id="method" name="method" required className={inputClass}>
          <option value="CHECK">Check</option>
          <option value="CASH">Cash</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      <div>
        <label htmlFor="amountPaid" className={labelClass}>
          Amount paid (optional)
        </label>
        <input
          id="amountPaid"
          name="amountPaid"
          type="number"
          step="0.01"
          min="0"
          placeholder="Leave blank for full rent"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="note" className={labelClass}>
          Note (optional)
        </label>
        <textarea
          id="note"
          name="note"
          rows={2}
          placeholder="e.g., Check #1234"
          className={inputClass}
        />
      </div>

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? "Saving…" : "Log Payment"}
      </Button>
    </form>
  );
}
