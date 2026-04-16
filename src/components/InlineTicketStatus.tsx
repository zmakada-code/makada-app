"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TicketStatus } from "@prisma/client";
import clsx from "clsx";

const OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RESOLVED", label: "Resolved" },
];

const styles: Record<TicketStatus, string> = {
  OPEN: "bg-amber-50 text-amber-700 border-amber-200",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200",
  RESOLVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

/**
 * Inline status select that posts to the `action` (setTicketStatus) and
 * refreshes server data in place. Does not navigate.
 */
export function InlineTicketStatus({
  id,
  status,
  action,
}: {
  id: string;
  status: TicketStatus;
  action: (formData: FormData) => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={(fd) => start(async () => {
      await action(fd);
      router.refresh();
    })}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="inline" value="1" />
      <select
        name="status"
        defaultValue={status}
        disabled={pending}
        onChange={() => formRef.current?.requestSubmit()}
        className={clsx(
          "rounded-full border px-2 py-0.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60",
          styles[status]
        )}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </form>
  );
}
