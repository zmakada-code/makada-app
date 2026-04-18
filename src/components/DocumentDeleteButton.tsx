"use client";

import { Trash2 } from "lucide-react";

export function DocumentDeleteButton({
  action,
}: {
  action: (formData: FormData) => void;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Delete this document?")) e.preventDefault();
      }}
    >
      <button
        type="submit"
        className="p-1 text-slate-400 hover:text-red-600 transition-colors"
        title="Delete document"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}
