"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Trash2, X } from "lucide-react";
import { addFee, markFeePaid, waiveFee, deleteFee } from "@/lib/actions/fees";

function SubmitBtn({ label, className }: { label: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "..." : label}
    </button>
  );
}

type FeeItem = {
  id: string;
  name: string;
  amount: number;
  isRecurring: boolean;
  paidStatus: string;
  paidAmount: number | null;
  paidAt: string | null;
  paymentMethod: string | null;
  dueDate: string | null;
  note: string | null;
};

export function FeesSection({
  leaseId,
  fees,
}: {
  leaseId: string;
  fees: FeeItem[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [payingFeeId, setPayingFeeId] = useState<string | null>(null);

  const unpaidFees = fees.filter((f) => f.paidStatus === "UNPAID" || f.paidStatus === "PARTIAL");
  const paidFees = fees.filter((f) => f.paidStatus === "PAID" || f.paidStatus === "WAIVED");

  return (
    <div className="card p-6 mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-900">Fees & Charges</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition"
        >
          <Plus className="h-3 w-3" /> Add fee
        </button>
      </div>

      {/* Add fee form */}
      {showForm && (
        <form
          action={async (fd) => {
            await addFee(fd);
            setShowForm(false);
          }}
          className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3"
        >
          <input type="hidden" name="leaseId" value={leaseId} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Fee name</label>
              <input
                type="text"
                name="name"
                required
                placeholder="Pet fee, parking, cleaning..."
                className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Amount ($)</label>
              <input
                type="number"
                name="amount"
                step="0.01"
                min="0.01"
                required
                placeholder="50.00"
                className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Type</label>
              <select
                name="isRecurring"
                className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
              >
                <option value="false">One-time</option>
                <option value="true">Monthly recurring</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">First due date</label>
              <input
                type="date"
                name="dueDate"
                className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">For recurring: when the 1st charge is due (charged monthly on the 1st after).</p>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Note (optional)</label>
            <input
              type="text"
              name="note"
              placeholder="Additional details..."
              className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <SubmitBtn
              label="Add fee"
              className="rounded-md bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition"
            />
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Unpaid fees */}
      {unpaidFees.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs font-medium text-red-600 uppercase tracking-wide">Outstanding</p>
          {unpaidFees.map((fee) => (
            <div key={fee.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {fee.name}
                  {fee.isRecurring && (
                    <span className="ml-1.5 text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-full px-1.5 py-0.5">
                      Monthly
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  ${Number(fee.amount).toLocaleString()}
                  {fee.dueDate && ` · Due ${new Date(fee.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                  {fee.note && ` · ${fee.note}`}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {payingFeeId === fee.id ? (
                  <form action={markFeePaid} className="flex items-center gap-2">
                    <input type="hidden" name="feeId" value={fee.id} />
                    <select name="method" className="rounded border border-slate-200 px-2 py-1 text-xs">
                      <option value="CHECK">Check</option>
                      <option value="CASH">Cash</option>
                      <option value="ONLINE">Online</option>
                      <option value="OTHER">Other</option>
                    </select>
                    <SubmitBtn
                      label="Confirm"
                      className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    />
                    <button type="button" onClick={() => setPayingFeeId(null)} className="text-slate-400 hover:text-slate-600">
                      <X className="h-3 w-3" />
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      onClick={() => setPayingFeeId(fee.id)}
                      className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 transition"
                    >
                      Mark paid
                    </button>
                    <form action={waiveFee}>
                      <input type="hidden" name="feeId" value={fee.id} />
                      <SubmitBtn
                        label="Waive"
                        className="rounded bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-50 transition"
                      />
                    </form>
                    <form action={deleteFee}>
                      <input type="hidden" name="feeId" value={fee.id} />
                      <button type="submit" className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paid fees */}
      {paidFees.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Settled</p>
          {paidFees.map((fee) => (
            <div key={fee.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg">
              <div>
                <p className="text-sm font-medium text-slate-600 line-through">
                  {fee.name}
                </p>
                <p className="text-xs text-slate-400">
                  ${Number(fee.amount).toLocaleString()}
                  {fee.paidStatus === "WAIVED" ? " · Waived" : ` · Paid ${fee.paymentMethod?.toLowerCase() ?? ""}`}
                  {fee.paidAt && ` on ${new Date(fee.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                </p>
              </div>
              <span className={`text-xs font-medium ${fee.paidStatus === "WAIVED" ? "text-slate-400" : "text-emerald-600"}`}>
                {fee.paidStatus === "WAIVED" ? "Waived" : "Paid"}
              </span>
            </div>
          ))}
        </div>
      )}

      {fees.length === 0 && !showForm && (
        <p className="text-sm text-slate-400 text-center py-3">
          No additional fees. Click &ldquo;Add fee&rdquo; to charge a pet fee, parking, etc.
        </p>
      )}
    </div>
  );
}
