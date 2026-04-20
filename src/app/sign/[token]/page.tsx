"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";

type SigningField = {
  id: string;
  type: "signature" | "initials" | "date";
  label: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type LeaseData = {
  leaseId: string;
  tenantName: string;
  email: string;
  propertyName: string;
  propertyAddress: string;
  unitLabel: string;
  bedrooms: number;
  bathrooms: number;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  leaseType: string;
  pdfUrl: string;
  signingFields: SigningField[];
  pageCount: number;
};

type FilledField = { fieldId: string; dataUrl: string };

export default function PublicSigningPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lease, setLease] = useState<LeaseData | null>(null);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [pageDims, setPageDims] = useState<{ w: number; h: number }[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [activeField, setActiveField] = useState<SigningField | null>(null);
  const [filledFields, setFilledFields] = useState<FilledField[]>([]);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [initialsDataUrl, setInitialsDataUrl] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [drawMode, setDrawMode] = useState<"draw" | "type">("draw");
  const [typedName, setTypedName] = useState("");

  // Load lease data
  useEffect(() => {
    fetch(`/api/sign/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load lease");
        }
        return res.json();
      })
      .then((data) => {
        setLease(data);
        if (data.pdfUrl) renderPdf(data.pdfUrl);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function renderPdf(url: string) {
    setPdfLoading(true);
    try {
      const pdfjsLib = await loadPdfJs();
      const pdfDoc = await pdfjsLib.getDocument(url).promise;
      const imgs: string[] = [];
      const dims: { w: number; h: number }[] = [];

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
        imgs.push(canvas.toDataURL("image/png"));
        const orig = page.getViewport({ scale: 1 });
        dims.push({ w: orig.width, h: orig.height });
      }

      setPageImages(imgs);
      setPageDims(dims);
    } catch {
      setError("Failed to load the lease document.");
    } finally {
      setPdfLoading(false);
    }
  }

  const sigFields = lease?.signingFields || [];
  const signatureFields = sigFields.filter((f) => f.type === "signature");
  const initialsFields = sigFields.filter((f) => f.type === "initials");
  const allFilled =
    signatureFields.every((f) => filledFields.some((ff) => ff.fieldId === f.id)) &&
    initialsFields.every((f) => filledFields.some((ff) => ff.fieldId === f.id));
  const unfilledCount =
    signatureFields.filter((f) => !filledFields.some((ff) => ff.fieldId === f.id)).length +
    initialsFields.filter((f) => !filledFields.some((ff) => ff.fieldId === f.id)).length;

  function handleFieldClick(field: SigningField) {
    if (field.type === "date") return;
    setActiveField(field);
  }

  function applySignature(dataUrl: string) {
    if (!activeField) return;
    if (activeField.type === "signature") setSignatureDataUrl(dataUrl);
    if (activeField.type === "initials") setInitialsDataUrl(dataUrl);

    const sameTypeFields = sigFields.filter((f) => f.type === activeField.type);
    setFilledFields((prev) => {
      let result = prev.filter((ff) => !sameTypeFields.some((sf) => sf.id === ff.fieldId));
      for (const f of sameTypeFields) {
        result.push({ fieldId: f.id, dataUrl });
      }
      return result;
    });
    setActiveField(null);
  }

  async function handleSubmit() {
    if (!allFilled || !agreed || !signatureDataUrl) return;
    setSigning(true);
    setError("");

    try {
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature: signatureDataUrl, initials: initialsDataUrl }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to sign");
      }
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSigning(false);
    }
  }

  function getFieldStyle(field: SigningField, dim: { w: number; h: number }) {
    return {
      left: `${(field.x / dim.w) * 100}%`,
      top: `${((dim.h - field.y - field.height) / dim.h) * 100}%`,
      width: `${(field.width / dim.w) * 100}%`,
      height: `${(field.height / dim.h) * 100}%`,
    };
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading your lease...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !lease) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Unable to Load Lease</h1>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">Lease Signed!</h1>
          <p className="text-slate-600 mb-6">
            Your lease has been signed and submitted to MZAN Capital.
            You'll receive a copy of the signed lease and login credentials for the tenant portal shortly.
          </p>
          <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-800 mb-1">What happens next?</p>
            <p>Check your email for your tenant portal login credentials, where you can view your lease, pay rent, and submit maintenance requests.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">MZAN Capital</h1>
            <p className="text-xs text-slate-500">Lease Signing</p>
          </div>
          <div className="text-right text-sm">
            <p className="text-slate-700 font-medium">{lease?.tenantName}</p>
            <p className="text-slate-500 text-xs">
              {lease?.propertyName} — Unit {lease?.unitLabel}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Instructions */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-indigo-800">
            Review your lease below. Click on the highlighted <strong>signature</strong> and{" "}
            <strong>initials</strong> fields directly on the document to sign. Once all fields are
            completed, scroll to the bottom to submit.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Progress */}
        <div className="bg-white rounded-lg border border-slate-200 px-4 py-3 mb-4 flex items-center justify-between">
          {allFilled ? (
            <span className="text-sm font-medium text-emerald-700 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              All fields completed
            </span>
          ) : (
            <span className="text-sm text-amber-700 font-medium">
              {unfilledCount} field{unfilledCount !== 1 ? "s" : ""} remaining
            </span>
          )}
          <span className="text-xs text-slate-500">Scroll and click highlighted areas</span>
        </div>

        {/* PDF pages */}
        {pdfLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500">Rendering lease document...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {pageImages.map((img, idx) => (
              <div key={idx} className="relative border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                <img src={img} alt={`Page ${idx + 1}`} className="w-full h-auto" draggable={false} />
                {sigFields
                  .filter((f) => f.page === idx && f.type !== "date")
                  .map((field) => {
                    const filled = filledFields.find((ff) => ff.fieldId === field.id);
                    return (
                      <div
                        key={field.id}
                        className={`absolute cursor-pointer transition-all ${
                          filled
                            ? "border-2 border-emerald-400 bg-emerald-50/30"
                            : "border-2 border-indigo-400 bg-indigo-50/50 animate-pulse hover:bg-indigo-100/60"
                        }`}
                        style={{ ...getFieldStyle(field, pageDims[idx]), zIndex: 10 }}
                        onClick={() => !filled && handleFieldClick(field)}
                      >
                        {filled ? (
                          <img src={filled.dataUrl} alt={field.label} className="w-full h-full object-contain p-0.5" />
                        ) : (
                          <div className="flex items-center justify-center w-full h-full">
                            <span className="text-[10px] font-medium text-indigo-600 uppercase tracking-wide">
                              {field.type === "signature" ? "Sign here" : "Initial"}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                <div className="absolute bottom-2 right-3 text-xs text-slate-400">
                  Page {idx + 1} of {pageImages.length}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Agreement and submit */}
        <div className="mt-8 bg-white rounded-lg border border-slate-200 p-6 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-slate-600">
              I have read the full lease agreement above and agree to all terms and conditions.
              I understand that my electronic signature is legally binding.
            </span>
          </label>

          <button
            onClick={handleSubmit}
            disabled={!allFilled || !agreed || signing}
            className="w-full rounded-md bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {signing
              ? "Submitting..."
              : !allFilled
              ? `Complete all fields to sign (${unfilledCount} remaining)`
              : !agreed
              ? "Accept terms to sign"
              : "Sign Lease Agreement"}
          </button>
        </div>
      </main>

      {/* Signature modal */}
      {activeField && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {activeField.type === "signature" ? "Draw Your Signature" : "Draw Your Initials"}
              </h3>
              <button onClick={() => setActiveField(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              {activeField.type === "signature"
                ? "Your signature will be placed on all signature lines."
                : "Your initials will be placed on all initial fields."}
            </p>

            {/* Mode toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setDrawMode("draw")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  drawMode === "draw" ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                Draw
              </button>
              <button
                onClick={() => setDrawMode("type")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  drawMode === "type" ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                Type
              </button>
            </div>

            {drawMode === "draw" ? (
              <DrawPad onComplete={applySignature} />
            ) : (
              <TypePad
                value={typedName}
                onChange={setTypedName}
                onComplete={applySignature}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Canvas-based drawing pad */
function DrawPad({ onComplete }: { onComplete: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const r = c.getBoundingClientRect();
    c.width = r.width * 2;
    c.height = r.height * 2;
    ctx.scale(2, 2);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#000";
  }, []);

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const r = canvasRef.current!.getBoundingClientRect();
    if ("touches" in e) return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e);
  }

  function move(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  }

  function stop() {
    isDrawing.current = false;
  }

  function clear() {
    const c = canvasRef.current;
    if (!c) return;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
  }

  function apply() {
    const c = canvasRef.current;
    if (!c) return;
    onComplete(c.toDataURL("image/png"));
  }

  return (
    <div>
      <div className="border-2 border-dashed border-slate-300 rounded-lg bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-40 cursor-crosshair touch-none"
          onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={start} onTouchMove={move} onTouchEnd={stop}
        />
      </div>
      <div className="flex items-center justify-between mt-3">
        <button onClick={clear} className="text-xs text-slate-500 hover:text-slate-700 underline">Clear</button>
        <button onClick={apply} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          Apply
        </button>
      </div>
    </div>
  );
}

/** Type-to-sign pad */
function TypePad({
  value,
  onChange,
  onComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete: (dataUrl: string) => void;
}) {
  function apply() {
    if (!value.trim()) return;
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 150;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 600, 150);
    ctx.fillStyle = "#000";
    ctx.font = "italic 48px Georgia, 'Times New Roman', serif";
    ctx.fillText(value, 20, 90);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, 110);
    ctx.lineTo(580, 110);
    ctx.stroke();
    onComplete(canvas.toDataURL("image/png"));
  }

  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your full name"
        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {value && (
        <div className="mt-3 border border-slate-200 rounded-lg bg-white px-6 py-4">
          <p className="text-3xl text-slate-900" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic" }}>
            {value}
          </p>
          <div className="border-t border-slate-300 mt-2" />
        </div>
      )}
      <div className="flex justify-end mt-3">
        <button
          onClick={apply}
          disabled={!value.trim()}
          className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

async function loadPdfJs(): Promise<any> {
  if ((window as any).pdfjsLib) return (window as any).pdfjsLib;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (!lib) return reject(new Error("pdf.js failed"));
      lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(lib);
    };
    s.onerror = () => reject(new Error("Failed to load pdf.js"));
    document.head.appendChild(s);
  });
}
