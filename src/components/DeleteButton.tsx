"use client";

import { Button } from "@/components/ui/Button";

export function DeleteButton({
  action,
  confirmText,
  label = "Delete",
}: {
  action: (formData: FormData) => void;
  confirmText: string;
  label?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      <Button type="submit" variant="danger">
        {label}
      </Button>
    </form>
  );
}
