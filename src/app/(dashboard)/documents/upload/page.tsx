import { PageHeader } from "@/components/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Flash } from "@/components/Flash";
import { AIUploadForm } from "./AIUploadForm";

export const dynamic = "force-dynamic";

export default function AIUploadPage() {
  return (
    <div>
      <Flash />
      <PageHeader
        title="AI Document Upload"
        description="Upload a bill, invoice, lease, or any property document. AI will automatically categorize it and file it to the correct property and unit."
        action={
          <ButtonLink href="/documents" variant="secondary">
            Back to Documents
          </ButtonLink>
        }
      />
      <div className="max-w-xl">
        <AIUploadForm />
      </div>
    </div>
  );
}
