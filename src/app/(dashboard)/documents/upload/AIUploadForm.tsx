"use client";

import { useState } from "react";
import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

type PropertyOption = {
  id: string;
  name: string;
  address: string;
  units: { id: string; label: string }[];
};

type Analysis = {
  documentType: string;
  propertyId: string | null;
  unitId: string | null;
  description: string;
  vendor: string | null;
  amount: number | null;
  date: string | null;
  expenseCategory: string | null;
  isExpense: boolean;
  reference: string | null;
  confidence: string;
};

const DOC_TYPES = [
  { value: "LEASE", label: "Lease" },
  { value: "INVOICE", label: "Invoice" },
  { value: "TAX", label: "Tax" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "RECEIPT", label: "Receipt" },
  { value: "NOTICE", label: "Notice" },
  { value: "RULES", label: "House Rules" },
  { value: "OTHER", label: "Other" },
];

const EXPENSE_CATEGORIES = [
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

const MAX_SIZE = 4 * 1024 * 1024;

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1600;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
        else { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => reject(new Error("Could not read image"));
    img.src = URL.createObjectURL(file);
  });
}

export function AIUploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [saved, setSaved] = useState(false);

  // Editable analysis state
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [properties, setProperties] = useState<PropertyOption[]>([]);

  function acceptFile(f: File) {
    setFile(f);
    setAnalysis(null);
    setSaved(false);
    setError("");
  }

  // Step 1: Analyze
  async function handleAnalyze() {
    if (!file) return;
    setAnalyzing(true);
    setError("");

    try {
      let uploadFile = file;
      if (file.type.startsWith("image/") && file.size > MAX_SIZE) {
        try { uploadFile = await compressImage(file); } catch { /* use original */ }
      }

      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("action", "analyze");

      const res = await fetch("/api/documents/ai-upload", { method: "POST", body: formData });
      let data;
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        data = await res.json();
      } else {
        throw new Error(await res.text() || `Server error (${res.status})`);
      }

      if (!res.ok) throw new Error(data.error || "Analysis failed");

      setAnalysis(data.analysis);
      setProperties(data.properties || []);
    } catch (err) {
      setError((err as Error).message || "Something went wrong.");
    } finally {
      setAnalyzing(false);
    }
  }

  // Step 2: Save with edits
  async function handleSave() {
    if (!file || !analysis) return;
    setSaving(true);
    setError("");

    try {
      let uploadFile = file;
      if (file.type.startsWith("image/") && file.size > MAX_SIZE) {
        try { uploadFile = await compressImage(file); } catch { /* use original */ }
      }

      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("action", "save");
      formData.append("documentType", analysis.documentType);
      if (analysis.propertyId) formData.append("propertyId", analysis.propertyId);
      if (analysis.unitId) formData.append("unitId", analysis.unitId);
      formData.append("description", analysis.description || "");
      if (analysis.vendor) formData.append("vendor", analysis.vendor);
      if (analysis.amount != null) formData.append("amount", String(analysis.amount));
      if (analysis.date) formData.append("date", analysis.date);
      if (analysis.expenseCategory) formData.append("expenseCategory", analysis.expenseCategory);
      formData.append("isExpense", String(analysis.isExpense));
      if (analysis.reference) formData.append("reference", analysis.reference);
      formData.append("confidence", analysis.confidence);

      const res = await fetch("/api/documents/ai-upload", { method: "POST", body: formData });
      let data;
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        data = await res.json();
      } else {
        throw new Error(await res.text() || `Server error (${res.status})`);
      }

      if (!res.ok) throw new Error(data.error || "Save failed");

      setSaved(true);
      setAnalysis(null);
    } catch (err) {
      setError((err as Error).message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  function updateField<K extends keyof Analysis>(key: K, value: Analysis[K]) {
    if (!analysis) return;
    setAnalysis({ ...analysis, [key]: value });
  }

  const selectedProperty = properties.find((p) => p.id === analysis?.propertyId);
  const units = selectedProperty?.units || [];

  const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"];

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const dropped = e.dataTransfer.files[0];
          if (dropped && allowed.includes(dropped.type)) acceptFile(dropped);
          else if (dropped) setError("Please upload a PDF or image file.");
        }}
        className={`card border-2 border-dashed p-10 text-center transition-colors cursor-pointer ${
          dragOver ? "border-indigo-400 bg-indigo-50/50" : "border-slate-200 hover:border-slate-300"
        }`}
        onClick={() => document.getElementById("ai-file-input")?.click()}
      >
        <Upload className="h-10 w-10 text-slate-300 mx-auto mb-3" />
        {file ? (
          <div>
            <p className="text-sm font-medium text-slate-900">{file.name}</p>
            <p className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-slate-700">Drop a file here or click to browse</p>
            <p className="text-xs text-slate-400 mt-1">PDFs, photos, or scans of bills, invoices, leases, tax docs — anything property-related</p>
          </div>
        )}
        <input
          id="ai-file-input"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.gif"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) acceptFile(f); }}
        />
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Step 1: Analyze button */}
      {file && !analysis && !saved && (
        <Button onClick={handleAnalyze} disabled={analyzing} className="w-full">
          {analyzing ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing with AI…
            </span>
          ) : "Upload & Analyze"}
        </Button>
      )}

      {/* Step 2: Editable results */}
      {analysis && !saved && (
        <div className="card p-5 space-y-4">
          <p className="text-sm font-semibold text-slate-700">Review & edit before saving:</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Document Type */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Document Type</label>
              <select
                value={analysis.documentType}
                onChange={(e) => updateField("documentType", e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {/* Property */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Property</label>
              <select
                value={analysis.propertyId || ""}
                onChange={(e) => {
                  updateField("propertyId", e.target.value || null);
                  updateField("unitId", null);
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Select property —</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* Unit */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Unit</label>
              <select
                value={analysis.unitId || ""}
                onChange={(e) => updateField("unitId", e.target.value || null)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— No unit (property-level) —</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
              <input
                type="text"
                value={analysis.description || ""}
                onChange={(e) => updateField("description", e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Vendor */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Vendor</label>
              <input
                type="text"
                value={analysis.vendor || ""}
                onChange={(e) => updateField("vendor", e.target.value || null)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Amount ($)</label>
              <input
                type="number"
                step="0.01"
                value={analysis.amount ?? ""}
                onChange={(e) => updateField("amount", e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
              <input
                type="date"
                value={analysis.date || ""}
                onChange={(e) => updateField("date", e.target.value || null)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Reference */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Reference / Invoice #</label>
              <input
                type="text"
                value={analysis.reference || ""}
                onChange={(e) => updateField("reference", e.target.value || null)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Is Expense toggle */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={analysis.isExpense}
                onChange={(e) => updateField("isExpense", e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-700">Also log as an expense</span>
            </label>
          </div>

          {/* Expense Category (if expense) */}
          {analysis.isExpense && (
            <div className="max-w-xs">
              <label className="block text-xs font-medium text-slate-500 mb-1">Expense Category</label>
              <select
                value={analysis.expenseCategory || "OTHER"}
                onChange={(e) => updateField("expenseCategory", e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {EXPENSE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          )}

          {/* Confidence badge */}
          <div className="text-xs text-slate-400">
            AI confidence: <span className={`font-medium ${
              analysis.confidence === "high" ? "text-emerald-600" :
              analysis.confidence === "medium" ? "text-amber-600" : "text-red-600"
            }`}>{analysis.confidence}</span>
          </div>

          {/* Save button */}
          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </span>
              ) : "Save Document"}
            </Button>
            <Button onClick={() => { setAnalysis(null); setFile(null); }} variant="secondary">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Success */}
      {saved && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-semibold">Document saved and filed successfully!</span>
          </div>
          <Button onClick={() => { setFile(null); setSaved(false); setError(""); }} variant="secondary" className="w-full">
            Upload another document
          </Button>
        </div>
      )}
    </div>
  );
}
