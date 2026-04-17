import { PageHeader } from "@/components/PageHeader";
import { GenerateLeaseForm } from "./GenerateLeaseForm";

export default function GenerateLeasePage({
  searchParams,
}: {
  searchParams: { leaseId?: string };
}) {
  return (
    <div>
      <PageHeader
        title="Generate Lease Document"
        description={
          searchParams.leaseId
            ? "Review and edit the pre-filled lease fields, then download the completed document."
            : "Fill in the lease details below to generate a completed lease document from the master template."
        }
      />
      <GenerateLeaseForm leaseId={searchParams.leaseId} />
    </div>
  );
}
