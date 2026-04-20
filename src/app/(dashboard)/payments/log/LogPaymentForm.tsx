"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Camera, X } from "lucide-react";

type LeaseOption = {
  id: string;
  label: string;
  rent: number;
};

export function LogPaymentForm({ leases }: { leases: LeaseOption[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const fd = new FormData(e.currentTarget);

    // Use FormData for the API call so we can include the photo
    const submitData = new FormData();
    submitData.append("leaseId", fd.get("leaseId") as string);
    submitData.append("period", fd.get("period") as string);
    submitData.append("method", fd.get("method") as string);
    if (fd.get("amountPaid")) submitData.append("amountPaid", fd.get("amountPaid") as string);
    if (fd.get("note")) submitData.append("note", fd.get("note") as string);
    if (photoFile) submitData.append("photo", photoFile);

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        body: submitData,
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

      {/* Photo upload */}
      <div>
        <label className={labelClass}>Proof of payment (optional)</label>
        <p className="text-xs text-slate-400 mb-2">Upload a photo of the check, money order, or cash receipt.</p>
        {photoPreview ? (
          <div className="relative inline-block">
            <img
              src={photoPreview}
              alt="Payment proof"
              className="h-40 rounded-lg border border-slate-200 object-cover"
            />
            <button
              type="button"
              onClick={removePhoto}
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-lg border-2 border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          >
            <Camera className="h-4 w-4" /> Add photo
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          name="photo"
          accept="image/*"
          onChange={handlePhotoChange}
          className="hidden"
        />
      </div>

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? "Saving…" : "Log Payment"}
      </Button>
    </form>
  );
}
