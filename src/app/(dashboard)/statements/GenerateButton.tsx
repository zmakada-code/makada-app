"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Loader2 } from "lucide-react";

export function GenerateButton({ month }: { month: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/statements/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult(`Error: ${data.error}`);
      } else {
        const count = data.results?.filter((r: { status: string }) => r.status === "generated").length || 0;
        const existing = data.results?.filter((r: { status: string }) => r.status === "already exists").length || 0;
        setResult(`Generated ${count} statement(s)${existing ? `, ${existing} already existed` : ""}. Refresh to see them.`);
      }
    } catch {
      setResult("Failed to generate statements.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleGenerate} disabled={loading}>
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating…
          </span>
        ) : (
          "Generate All Statements"
        )}
      </Button>
      {result && <p className="text-xs text-slate-500 max-w-xs text-right">{result}</p>}
    </div>
  );
}
