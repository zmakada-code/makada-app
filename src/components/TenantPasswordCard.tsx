"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Eye, EyeOff, Copy, Check, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { setTenantPassword, setTenantLocked } from "@/lib/actions/tenants";

function SaveBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </Button>
  );
}

function LockBtn({ locked }: { locked: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="secondary"
      disabled={pending}
      className="inline-flex items-center gap-2"
    >
      {locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
      {pending
        ? "Working..."
        : locked
        ? "Unlock account"
        : "Lock account"}
    </Button>
  );
}

export function TenantPasswordCard({
  tenantId,
  hasEmail,
  currentPassword,
  locked,
  hasAuthAccount,
}: {
  tenantId: string;
  hasEmail: boolean;
  currentPassword: string | null;
  locked: boolean;
  hasAuthAccount: boolean;
}) {
  const [pwState, pwAction] = useFormState(setTenantPassword, {});
  const [lockState, lockAction] = useFormState(setTenantLocked, {});
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyPassword() {
    if (!currentPassword) return;
    try {
      await navigator.clipboard.writeText(currentPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  if (!hasEmail) {
    return (
      <div className="card p-5">
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">
          Portal account
        </div>
        <p className="text-sm text-slate-500">
          Add an email for this tenant to enable portal access.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wide text-slate-400">
          Portal account
        </div>
        {hasAuthAccount && (
          <span
            className={`text-xs rounded-full px-2 py-0.5 ${
              locked
                ? "bg-red-50 text-red-700"
                : "bg-green-50 text-green-700"
            }`}
          >
            {locked ? "Locked" : "Active"}
          </span>
        )}
      </div>

      <div className="mb-4">
        <div className="text-xs text-slate-500 mb-1">Current password</div>
        {currentPassword ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-slate-50 border border-slate-200 px-3 py-2 font-mono text-sm">
              {showPassword ? currentPassword : "•".repeat(currentPassword.length)}
            </code>
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="rounded-md border border-slate-200 p-2 hover:bg-slate-50"
              title={showPassword ? "Hide" : "Show"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={copyPassword}
              className="rounded-md border border-slate-200 p-2 hover:bg-slate-50"
              title="Copy"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No password set yet. Set one below.
          </p>
        )}
      </div>

      <form action={pwAction} className="space-y-3 mb-5">
        <input type="hidden" name="id" value={tenantId} />
        <Field label={currentPassword ? "Change password" : "Set password"}>
          <Input
            name="password"
            type="text"
            autoComplete="off"
            placeholder="At least 8 characters"
          />
        </Field>
        {pwState.error && <p className="text-sm text-red-600">{pwState.error}</p>}
        {pwState.success && (
          <p className="text-sm text-green-700">{pwState.success}</p>
        )}
        <SaveBtn label={currentPassword ? "Update password" : "Set password"} />
      </form>

      {hasAuthAccount && (
        <div className="border-t border-slate-200 pt-4">
          <p className="text-sm text-slate-600 mb-3">
            {locked
              ? "This tenant can't sign in right now. Unlock to restore access."
              : "Locking prevents the tenant from signing in but keeps all their data."}
          </p>
          <form action={lockAction}>
            <input type="hidden" name="id" value={tenantId} />
            <input type="hidden" name="locked" value={locked ? "false" : "true"} />
            <LockBtn locked={locked} />
            {lockState.error && (
              <p className="mt-2 text-sm text-red-600">{lockState.error}</p>
            )}
            {lockState.success && (
              <p className="mt-2 text-sm text-green-700">{lockState.success}</p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
