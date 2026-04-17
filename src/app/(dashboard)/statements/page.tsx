import Link from "next/link";
import { BarChart3, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Flash } from "@/components/Flash";
import { GenerateButton } from "./GenerateButton";

export const dynamic = "force-dynamic";

export default async function StatementsPage() {
  const properties = await prisma.property.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, address: true },
  });

  // Get stored statement documents
  const statementDocs = await prisma.document.findMany({
    where: {
      filename: { contains: "statement-" },
      linkedEntityType: "PROPERTY",
    },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, filename: true, linkedEntityId: true, uploadedAt: true },
  });

  // Group by property
  const docsByProperty: Record<string, typeof statementDocs> = {};
  for (const doc of statementDocs) {
    if (!docsByProperty[doc.linkedEntityId]) docsByProperty[doc.linkedEntityId] = [];
    docsByProperty[doc.linkedEntityId].push(doc);
  }

  // Generate month options for the last 12 months
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", { month: "long", year: "numeric" });
    months.push({ value, label });
  }

  const currentMonth = months[0]?.value || "";

  return (
    <div>
      <Flash />
      <PageHeader
        title="Owner Statements"
        description="Generate monthly owner statements per property showing income, expenses, and net income."
        action={<GenerateButton month={currentMonth} />}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {properties.map((p) => {
          const savedDocs = docsByProperty[p.id] || [];
          return (
            <div key={p.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{p.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{p.address}</p>
                </div>
                <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-indigo-500" />
                </div>
              </div>

              {/* Saved statements */}
              {savedDocs.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Saved Statements</p>
                  <div className="space-y-1">
                    {savedDocs.slice(0, 4).map((doc) => (
                      <Link
                        key={doc.id}
                        href={`/documents/${doc.id}`}
                        className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs hover:bg-emerald-50 transition-colors group"
                      >
                        <span className="text-slate-600">{doc.filename.replace("statement-", "").replace(/-/g, " ").replace(".pdf", "")}</span>
                        <span className="text-emerald-500 text-xs font-medium">View</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Generate on-demand */}
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Download Statement</p>
              <div className="space-y-1">
                {months.slice(0, 6).map((m) => (
                  <Link
                    key={m.value}
                    href={`/api/statements?propertyId=${p.id}&month=${m.value}`}
                    target="_blank"
                    className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs hover:bg-slate-50 transition-colors group"
                  >
                    <span className="text-slate-600">{m.label}</span>
                    <Download className="h-3.5 w-3.5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {properties.length === 0 && (
        <div className="card p-12 text-center">
          <BarChart3 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No properties yet. Add a property to generate statements.</p>
        </div>
      )}
    </div>
  );
}
