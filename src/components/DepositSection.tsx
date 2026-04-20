"use client";

import { useFormStatus } from "react-dom";
import { recordDepositPayment } from "@/lib/actions/fees";

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition"
    >
      {pending ? "Recording..." : label}
    </button>
  );
}

type Props = {
  leaseId: string;
  depositRequired: number;
  depositStatus: string;
  depositPaidAmount: number | null;
  depositPaidAt: string | null;
  depositPaymentMethod: string | null;
  depositNote: string | null;
};

export function DepositSection({
  leaseId,
  depositRequired,
  depositStatus,
  depositPaidAmount,
  depositPaidAt,
  depositPaymentMethod,
  depositNote,
}: Props) {
  const isPaid = depositStatus === "PAID";
  const isPartial = depositStatus === "PARTIAL";

  return (
    <div className="card p-6 mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-900">Security Deposit</h2>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isPaid
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : isPartial
              ? "bg-amber-50 text-amber-700 border border-amber-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {isPaid ? "Paid" : isPartial ? "Partial" : "Pending"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div>
          <p className="text-slate-500">Required</p>
          <p className="font-semibold text-slate-900">${depositRequired.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-slate-500">Paid</p>
          <p className="font-semibold text-slate-900">
            {depositPaidAmount != null ? `$${depositPaidAmount.toLocaleString()}` : "$0"}
          </p>
        </div>
        {depositPaidAt && (
          <div>
            <p className="text-slate-500">Paid on</p>
            <p className="text-slate-700">
              {new Date(depositPaidAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        )}
        {depositPaymentMethod && (
          <div>
            <p className="text-slate-500">Method</p>
            <p className="text-slate-700 capitalize">{depositPaymentMethod.toLowerCase()}</p>
          </div>
        )}
      </div>

      {depositNote && (
        <p className="text-xs text-slate-500 mb-4">Note: {depositNote}</p>
      )}

      {!isPaid && (
        <form action={recordDepositPayment} className="border-t border-slate-100 pt-4 space-y-3">
          <input type="hidden" name="leaseId" value={leaseId} />
          <p className="text-xs font-medium text-slate-600">Record deposit payment</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Amount</label>
              <input
                type="number"
                name="amount"
                step="0.01"
                min="0"
                defaultValue={depositRequired}
                className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Method</label>
              <select
                name="method"
                className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
              >
                <option value="CHECK">Check</option>
                <option value="CASH">Cash</option>
                <option value="ONLINE">Online / Stripe</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Note (optional)</label>
            <input
              type="text"
              name="note"
              placeholder="Check #, reference, etc."
              className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
            />
          </div>
          <SubmitBtn label="Record deposit payment" />
        </form>
      )}
    </div>
  );
}
