import { PageHeader } from "@/components/PageHeader";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="App configuration."
      />

      <div className="card p-5 max-w-md">
        <div className="text-sm font-medium mb-2">About</div>
        <p className="text-sm text-slate-600">
          MZAN Capital — internal property management tool.
        </p>
      </div>
    </div>
  );
}
