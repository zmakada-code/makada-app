"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

type PropertyOption = {
  id: string;
  name: string;
  units: { id: string; label: string }[];
};

export type ExpenseInitial = {
  propertyId: string;
  unitId: string;
  category: string;
  vendor: string;
  description: string;
  amount: string;
  date: string;
  reference: string;
  note: string;
};

const CATEGORIES = [
  { value: "REPAIRS", label: "Repairs" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "MANAGEMENT_FEE", label: "Management Fee" },
  { value: "PROPERTY_TAX", label: "Property Tax" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "UTILITIES", label: "Utilities" },
  { value: "LANDSCAPING", label: "Landscaping" },
  { value: "CLEANING", label: "Cleaning" },
  { value: "PEST_CONTROL", label: "Pest Control" },
  { value: "LEGAL", label: "Legal" },
  { value: "SUPPLIES", label: "Supplies" },
  { value: "OTHER", label: "Other" },
];

export function ExpenseForm({
  properties,
  initial,
  expenseId,
}: {
  properties: PropertyOption[];
  initial?: ExpenseInitial;
  expenseId?: string;
}) {
  const router = useRouter();
  const isEdit = !!expenseId;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedProperty, setSelectedProperty] = useState(initial?.propertyId || "");

  const units = properties.find((p) => p.id === selectedProperty)?.units ?? [];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const body = {
      propertyId: fd.get("propertyId"),
      unitId: fd.get("unitId") || null,
      category: fd.get("category"),
      vendor: fd.get("vendor") || null,
      description: fd.get("description"),
      amount: Number(fd.get("amount")),
      date: fd.get("date"),
      reference: fd.get("reference") || null,
      note: fd.get("note") || null,
    };

    try {
      const url = isEdit ? `/api/expenses/${expenseId}` : "/api/expenses";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${isEdit ? "update" : "add"} expense`);
      }

      const flash = isEdit ? "Expense+updated" : "Expense+added";
      router.push(`/expenses?flash=${flash}`);
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
        <label htmlFor="propertyId" className={labelClass}>Property</label>
        <select
          id="propertyId"
          name="propertyId"
          required
          className={inputClass}
          value={selectedProperty}
          onChange={(e) => setSelectedProperty(e.target.value)}
        >
          <option value="">Select a property…</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {units.length > 0 && (
        <div>
          <label htmlFor="unitId" className={labelClass}>Unit (optional)</label>
          <select id="unitId" name="unitId" className={inputClass} defaultValue={initial?.unitId || ""}>
            <option value="">Property-wide</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.label}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label htmlFor="category" className={labelClass}>Category</label>
        <select id="category" name="category" required className={inputClass} defaultValue={initial?.category || "REPAIRS"}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="vendor" className={labelClass}>Vendor / Payee</label>
        <input id="vendor" name="vendor" type="text" placeholder="e.g., John Oliver Construction" className={inputClass} defaultValue={initial?.vendor || ""} />
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>Description</label>
        <input id="description" name="description" type="text" required placeholder="e.g., Plumbing repair — bathroom" className={inputClass} defaultValue={initial?.description || ""} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="amount" className={labelClass}>Amount ($)</label>
          <input id="amount" name="amount" type="number" step="0.01" min="0" required className={inputClass} defaultValue={initial?.amount || ""} />
        </div>
        <div>
          <label htmlFor="date" className={labelClass}>Date</label>
          <input id="date" name="date" type="date" required defaultValue={initial?.date || new Date().toISOString().split("T")[0]} className={inputClass} />
        </div>
      </div>

      <div>
        <label htmlFor="reference" className={labelClass}>Reference # (optional)</label>
        <input id="reference" name="reference" type="text" placeholder="Check #, Invoice #, etc." className={inputClass} defaultValue={initial?.reference || ""} />
      </div>

      <div>
        <label htmlFor="note" className={labelClass}>Note (optional)</label>
        <textarea id="note" name="note" rows={2} className={inputClass} defaultValue={initial?.note || ""} />
      </div>

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Expense"}
      </Button>
    </form>
  );
}
