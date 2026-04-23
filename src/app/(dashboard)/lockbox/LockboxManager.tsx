"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Key,
  Lock,
  Clock,
  Plus,
  Pencil,
  Trash2,
  ShieldOff,
  ShieldCheck,
  ChevronDown,
  Eye,
  EyeOff,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type LockboxCode = {
  id: string;
  propertyId: string;
  label: string;
  code: string;
  notes: string | null;
};

type SmartLockCode = {
  id: string;
  unitId: string;
  label: string;
  code: string;
  isActive: boolean;
  expiresAt: string | null;
  notes: string | null;
};

type TempAccessCode = {
  id: string;
  propertyId: string;
  unitId: string | null;
  code: string;
  issuedTo: string;
  reason: string | null;
  isActive: boolean;
  expiresAt: string;
};

type UnitData = {
  id: string;
  label: string;
  smartLockCodes: SmartLockCode[];
};

type PropertyData = {
  id: string;
  name: string;
  address: string;
  lockboxCodes: LockboxCode[];
  units: UnitData[];
  tempAccessCodes: TempAccessCode[];
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function isExpired(dt: string | null) {
  if (!dt) return false;
  return new Date(dt) < new Date();
}

function formatExpiry(dt: string) {
  const d = new Date(dt);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  if (diffMs < 0) return "Expired";
  if (diffHours < 1) return `${Math.max(0, Math.round(diffMs / 60000))}m left`;
  if (diffHours < 24) return `${diffHours}h left`;

  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function generateCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function getExpiryPreset(preset: string): Date {
  const now = new Date();
  switch (preset) {
    case "today-5pm": {
      const d = new Date(now);
      d.setHours(17, 0, 0, 0);
      if (d <= now) d.setDate(d.getDate() + 1);
      return d;
    }
    case "tomorrow-end": {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(23, 59, 0, 0);
      return d;
    }
    case "24h":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case "48h":
      return new Date(now.getTime() + 48 * 60 * 60 * 1000);
    case "1week":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

/* ------------------------------------------------------------------ */
/* Small UI atoms                                                      */
/* ------------------------------------------------------------------ */

function CodeDisplay({ code, small }: { code: string; small?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <code className={`font-mono font-bold tracking-widest ${small ? "text-sm" : "text-lg"} text-slate-900`}>
        {visible ? code : "••••"}
      </code>
      <button
        onClick={() => setVisible(!visible)}
        className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
        title={visible ? "Hide" : "Show"}
      >
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={handleCopy}
        className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
        title="Copy"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}

function StatusBadge({ active, expired }: { active: boolean; expired?: boolean }) {
  if (expired) return <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">Expired</span>;
  if (!active) return <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Revoked</span>;
  return <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">Active</span>;
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300 transition-colors";
const labelClass = "block text-sm font-medium text-slate-700 mb-1";

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export function LockboxManager({ properties }: { properties: PropertyData[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Modal state
  const [modal, setModal] = useState<{
    type: "lockbox" | "smartlock" | "tempcode";
    mode: "add" | "edit";
    propertyId: string;
    unitId?: string;
    existing?: any;
  } | null>(null);

  // Form state
  const [formData, setFormData] = useState<Record<string, string>>({});

  function openModal(
    type: "lockbox" | "smartlock" | "tempcode",
    mode: "add" | "edit",
    propertyId: string,
    unitId?: string,
    existing?: any
  ) {
    const defaults: Record<string, string> = {};
    if (existing) {
      if (type === "lockbox") {
        defaults.label = existing.label || "";
        defaults.code = existing.code || "";
        defaults.notes = existing.notes || "";
      } else if (type === "smartlock") {
        defaults.label = existing.label || "";
        defaults.code = existing.code || "";
        defaults.expiresAt = existing.expiresAt ? new Date(existing.expiresAt).toISOString().slice(0, 16) : "";
        defaults.notes = existing.notes || "";
      } else {
        defaults.code = existing.code || "";
        defaults.issuedTo = existing.issuedTo || "";
        defaults.reason = existing.reason || "";
        defaults.expiresAt = existing.expiresAt ? new Date(existing.expiresAt).toISOString().slice(0, 16) : "";
      }
    } else {
      defaults.code = generateCode();
      if (type === "tempcode") {
        defaults.expiresAt = getExpiryPreset("today-5pm").toISOString().slice(0, 16);
      }
    }
    setFormData(defaults);
    setModal({ type, mode, propertyId, unitId, existing });
  }

  async function handleSave() {
    if (!modal) return;
    setSaving(true);
    try {
      const { type, propertyId, unitId, existing } = modal;

      if (type === "lockbox") {
        await fetch("/api/lockbox", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: existing?.id,
            propertyId,
            label: formData.label || "Main lockbox",
            code: formData.code,
            notes: formData.notes || null,
          }),
        });
      } else if (type === "smartlock") {
        await fetch("/api/smart-lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: existing?.id,
            unitId,
            label: formData.label,
            code: formData.code,
            expiresAt: formData.expiresAt || null,
            notes: formData.notes || null,
          }),
        });
      } else {
        await fetch("/api/temp-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: existing?.id,
            propertyId,
            unitId: formData.unitId || null,
            code: formData.code,
            issuedTo: formData.issuedTo,
            reason: formData.reason || null,
            expiresAt: formData.expiresAt,
          }),
        });
      }

      setModal(null);
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(type: "lockbox" | "smartlock" | "tempcode", id: string) {
    if (!confirm("Delete this code?")) return;
    const endpoint = type === "lockbox" ? "/api/lockbox" : type === "smartlock" ? "/api/smart-lock" : "/api/temp-code";
    await fetch(`${endpoint}?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleRevoke(type: "smartlock" | "tempcode", id: string) {
    const endpoint = type === "smartlock" ? "/api/smart-lock" : "/api/temp-code";
    await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: false }),
    });
    router.refresh();
  }

  async function handleReactivate(id: string) {
    await fetch("/api/smart-lock", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: true }),
    });
    router.refresh();
  }

  // Count active temp codes across all properties
  const activeTempCodes = properties.reduce(
    (sum, p) => sum + p.tempAccessCodes.filter((c) => c.isActive && !isExpired(c.expiresAt)).length,
    0
  );

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Key className="h-4 w-4" /> Lockbox Codes
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {properties.reduce((s, p) => s + p.lockboxCodes.length, 0)}
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Lock className="h-4 w-4" /> Smart Lock Codes
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {properties.reduce((s, p) => s + p.units.reduce((us, u) => us + u.smartLockCodes.length, 0), 0)}
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Clock className="h-4 w-4" /> Active Temp Codes
          </div>
          <div className="text-2xl font-bold text-slate-900">{activeTempCodes}</div>
        </div>
      </div>

      {/* Per-property sections */}
      <div className="space-y-6">
        {properties.map((property) => (
          <details key={property.id} open className="group">
            <summary className="flex items-center gap-3 cursor-pointer list-none rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 hover:bg-slate-100 transition">
              <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-0 -rotate-90" />
              <Building2 className="h-4 w-4 text-indigo-500" />
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm text-slate-900">{property.name}</span>
                <span className="ml-2 text-xs text-slate-400">{property.address}</span>
              </div>
            </summary>

            <div className="mt-3 ml-4 space-y-4">
              {/* Lockbox codes */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Key className="h-4 w-4 text-amber-500" /> Lockbox Codes
                  </h4>
                  <button
                    onClick={() => openModal("lockbox", "add", property.id)}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>

                {property.lockboxCodes.length === 0 ? (
                  <p className="text-sm text-slate-400">No lockbox codes added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {property.lockboxCodes.map((lb) => (
                      <div key={lb.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50">
                        <div>
                          <span className="text-xs font-medium text-slate-500 mr-2">{lb.label}</span>
                          <CodeDisplay code={lb.code} />
                          {lb.notes && <span className="ml-2 text-xs text-slate-400">— {lb.notes}</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openModal("lockbox", "edit", property.id, undefined, lb)}
                            className="p-1.5 rounded hover:bg-white text-slate-400 hover:text-slate-600 transition"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete("lockbox", lb.id)}
                            className="p-1.5 rounded hover:bg-white text-slate-400 hover:text-red-500 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Smart lock codes per unit */}
              <div className="card p-4">
                <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
                  <Lock className="h-4 w-4 text-blue-500" /> Smart Lock Codes
                </h4>

                {property.units.length === 0 ? (
                  <p className="text-sm text-slate-400">No units in this property.</p>
                ) : (
                  <div className="space-y-3">
                    {property.units.map((unit) => (
                      <div key={unit.id}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{unit.label}</span>
                          <button
                            onClick={() => openModal("smartlock", "add", property.id, unit.id)}
                            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition"
                          >
                            <Plus className="h-3 w-3" /> Add
                          </button>
                        </div>

                        {unit.smartLockCodes.length === 0 ? (
                          <p className="text-xs text-slate-400 mb-2">No smart lock codes.</p>
                        ) : (
                          <div className="space-y-1.5 mb-2">
                            {unit.smartLockCodes.map((sl) => (
                              <div
                                key={sl.id}
                                className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                                  sl.isActive && !isExpired(sl.expiresAt) ? "bg-slate-50" : "bg-slate-50/50 opacity-60"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div>
                                    <span className="text-xs font-medium text-slate-500">{sl.label}</span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <CodeDisplay code={sl.code} small />
                                      <StatusBadge active={sl.isActive} expired={isExpired(sl.expiresAt)} />
                                      {sl.expiresAt && sl.isActive && !isExpired(sl.expiresAt) && (
                                        <span className="text-[11px] text-slate-400">{formatExpiry(sl.expiresAt)}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  {sl.isActive && !isExpired(sl.expiresAt) ? (
                                    <button
                                      onClick={() => handleRevoke("smartlock", sl.id)}
                                      className="p-1.5 rounded hover:bg-white text-slate-400 hover:text-amber-600 transition"
                                      title="Revoke"
                                    >
                                      <ShieldOff className="h-3.5 w-3.5" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleReactivate(sl.id)}
                                      className="p-1.5 rounded hover:bg-white text-slate-400 hover:text-green-600 transition"
                                      title="Reactivate"
                                    >
                                      <ShieldCheck className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => openModal("smartlock", "edit", property.id, unit.id, sl)}
                                    className="p-1.5 rounded hover:bg-white text-slate-400 hover:text-slate-600 transition"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete("smartlock", sl.id)}
                                    className="p-1.5 rounded hover:bg-white text-slate-400 hover:text-red-500 transition"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Temporary access codes */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-purple-500" /> Temporary Access Codes
                  </h4>
                  <button
                    onClick={() => openModal("tempcode", "add", property.id)}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition"
                  >
                    <Plus className="h-3.5 w-3.5" /> Generate
                  </button>
                </div>

                {property.tempAccessCodes.length === 0 ? (
                  <p className="text-sm text-slate-400">No temporary codes.</p>
                ) : (
                  <div className="space-y-1.5">
                    {property.tempAccessCodes.map((tc) => {
                      const expired = isExpired(tc.expiresAt);
                      const unitLabel = tc.unitId
                        ? property.units.find((u) => u.id === tc.unitId)?.label
                        : null;
                      return (
                        <div
                          key={tc.id}
                          className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                            tc.isActive && !expired ? "bg-purple-50/50" : "bg-slate-50/50 opacity-60"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-700">{tc.issuedTo}</span>
                              {unitLabel && (
                                <span className="text-[11px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {unitLabel}
                                </span>
                              )}
                              <StatusBadge active={tc.isActive} expired={expired} />
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <CodeDisplay code={tc.code} small />
                              {tc.isActive && !expired && (
                                <span className="text-[11px] text-purple-500 font-medium">{formatExpiry(tc.expiresAt)}</span>
                              )}
                              {tc.reason && <span className="text-[11px] text-slate-400">— {tc.reason}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {tc.isActive && !expired && (
                              <button
                                onClick={() => handleRevoke("tempcode", tc.id)}
                                className="p-1.5 rounded hover:bg-white text-slate-400 hover:text-amber-600 transition"
                                title="Revoke"
                              >
                                <ShieldOff className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete("tempcode", tc.id)}
                              className="p-1.5 rounded hover:bg-white text-slate-400 hover:text-red-500 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </details>
        ))}
      </div>

      {/* ---- Modals ---- */}

      {/* Lockbox modal */}
      <Modal
        open={modal?.type === "lockbox"}
        onClose={() => setModal(null)}
        title={modal?.mode === "edit" ? "Edit Lockbox Code" : "Add Lockbox Code"}
      >
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Label</label>
            <input
              className={inputClass}
              value={formData.label ?? ""}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="Main lockbox"
            />
          </div>
          <div>
            <label className={labelClass}>Code</label>
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={formData.code ?? ""}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="1234"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => setFormData({ ...formData, code: generateCode() })}
              >
                Random
              </Button>
            </div>
          </div>
          <div>
            <label className={labelClass}>Notes (optional)</label>
            <input
              className={inputClass}
              value={formData.notes ?? ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Location or other details"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !formData.code}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Smart lock modal */}
      <Modal
        open={modal?.type === "smartlock"}
        onClose={() => setModal(null)}
        title={modal?.mode === "edit" ? "Edit Smart Lock Code" : "Add Smart Lock Code"}
      >
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Lock name</label>
            <input
              className={inputClass}
              value={formData.label ?? ""}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="Front door"
            />
          </div>
          <div>
            <label className={labelClass}>Code</label>
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={formData.code ?? ""}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="1234"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => setFormData({ ...formData, code: generateCode() })}
              >
                Random
              </Button>
            </div>
          </div>
          <div>
            <label className={labelClass}>Expires (optional)</label>
            <input
              type="datetime-local"
              className={inputClass}
              value={formData.expiresAt ?? ""}
              onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>Notes (optional)</label>
            <input
              className={inputClass}
              value={formData.notes ?? ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any details"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !formData.code || !formData.label}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Temp code modal */}
      <Modal
        open={modal?.type === "tempcode"}
        onClose={() => setModal(null)}
        title={modal?.mode === "edit" ? "Edit Temporary Code" : "Generate Temporary Code"}
      >
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Issued to</label>
            <input
              className={inputClass}
              value={formData.issuedTo ?? ""}
              onChange={(e) => setFormData({ ...formData, issuedTo: e.target.value })}
              placeholder="Plumber, Showing - John Smith, etc."
            />
          </div>
          <div>
            <label className={labelClass}>Reason (optional)</label>
            <input
              className={inputClass}
              value={formData.reason ?? ""}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Maintenance visit, Property showing, etc."
            />
          </div>
          <div>
            <label className={labelClass}>Code</label>
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={formData.code ?? ""}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="1234"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => setFormData({ ...formData, code: generateCode() })}
              >
                Random
              </Button>
            </div>
          </div>
          <div>
            <label className={labelClass}>Unit (optional)</label>
            <select
              className={inputClass}
              value={formData.unitId ?? ""}
              onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
            >
              <option value="">Whole property</option>
              {modal &&
                properties
                  .find((p) => p.id === modal.propertyId)
                  ?.units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Expires</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {[
                { label: "Today 5pm", value: "today-5pm" },
                { label: "Tomorrow", value: "tomorrow-end" },
                { label: "24 hours", value: "24h" },
                { label: "48 hours", value: "48h" },
                { label: "1 week", value: "1week" },
              ].map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      expiresAt: getExpiryPreset(preset.value).toISOString().slice(0, 16),
                    })
                  }
                  className="text-xs px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <input
              type="datetime-local"
              className={inputClass}
              value={formData.expiresAt ?? ""}
              onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formData.code || !formData.issuedTo || !formData.expiresAt}
            >
              {saving ? "Saving…" : "Generate"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
