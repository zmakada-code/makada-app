"use client";

import { useState } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

type AnalysisResult = {
  document: { id: string; filename: string; type: string };
  expense: { id: string; amount: number; description: string } | null;
  analysis: {
    documentType: string;
    description: string;
    vendor: string | null;
    amount: number | null;
    confidence: string;
    isExpense: boolean;
    propertyId: string | null;
    unitId: string | null;
  };
  message: string;
};

export function AIUploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/documents/ai-upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to process document");
      }

      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"];
    if (dropped && allowed.includes(dropped.type)) {
      setFile(dropped);
      setResult(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`card border-2 border-dashed p-10 text-center transition-colors cursor-pointer ${
          dragOver ? "border-indigo-400 bg-indigo-50/50" : "border-slate-200 hover:border-slate-300"
        }`}
        onClick={() => document.getElementById("file-input")?.click()}
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
          id="file-input"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) { setFile(f); setResult(null); }
          }}
        />
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {file && !result && (
        <Button onClick={handleUpload} disabled={uploading} className="w-full">
          {uploading ? "Analyzing with AI…" : "Upload & Categorize"}
        </Button>
      )}

      {/* Results */}
      {result && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-semibold">Document processed successfully</span>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Type</span>
              <span className="font-medium text-slate-900">{result.analysis.documentType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Description</span>
              <span className="font-medium text-slate-900 text-right max-w-xs">{result.analysis.description}</span>
            </div>
            {result.analysis.vendor && (
              <div className="flex justify-between">
                <span className="text-slate-500">Vendor</span>
                <span className="font-medium text-slate-900">{result.analysis.vendor}</span>
              </div>
            )}
            {result.analysis.amount && (
              <div className="flex justify-between">
                <span className="text-slate-500">Amount</span>
                <span className="font-medium text-slate-900">${result.analysis.amount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Confidence</span>
              <span className={`font-medium ${
                result.analysis.confidence === "high" ? "text-emerald-600" :
                result.analysis.confidence === "medium" ? "text-amber-600" : "text-red-600"
              }`}>{result.analysis.confidence}</span>
            </div>
            {result.expense && (
              <div className="mt-3 p-3 rounded-lg bg-indigo-50 text-xs text-indigo-700">
                Expense of ${result.expense.amount.toLocaleString()} automatically added to the Expenses page.
              </div>
            )}
          </div>

          <Button
            onClick={() => { setFile(null); setResult(null); }}
            variant="secondary"
            className="w-full"
          >
            Upload another document
          </Button>
        </div>
      )}
    </div>
  );
}
