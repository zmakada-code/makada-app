import { PageHeader } from "@/components/PageHeader";
import { getCurrentUser, getAllowedEmails } from "@/lib/auth";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const allowed = getAllowedEmails();

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Account info and app configuration."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="text-sm font-medium mb-2">Your account</div>
          <div className="text-sm text-slate-600">Signed in as</div>
          <div className="text-sm font-mono mt-1">{user?.email ?? "—"}</div>
        </div>

        <div className="card p-5">
          <div className="text-sm font-medium mb-2">Allowlisted emails</div>
          <p className="text-xs text-slate-500 mb-2">
            Edit <code className="bg-slate-100 px-1 rounded">ALLOWED_EMAILS</code> in your
            environment to change access.
          </p>
          <ul className="text-sm font-mono space-y-1">
            {allowed.length === 0 ? (
              <li className="text-slate-400">none configured</li>
            ) : (
              allowed.map((e) => <li key={e}>{e}</li>)
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
