import { PageHeader } from "@/components/PageHeader";
import { TenantForm } from "@/components/TenantForm";
import { createTenant } from "@/lib/actions/tenants";

export const dynamic = "force-dynamic";

export default function NewTenantPage({
  searchParams,
}: {
  searchParams: {
    fromInquiry?: string;
    fullName?: string;
    phone?: string;
    email?: string;
  };
}) {
  const fromInquiry = !!searchParams.fromInquiry;
  return (
    <div>
      <PageHeader
        title="Add tenant"
        description={
          fromInquiry
            ? "Prefilled from an inquiry. Mark the inquiry as Converted after creating the tenant."
            : "Create a new tenant record."
        }
      />
      <TenantForm
        action={createTenant}
        initial={{
          fullName: searchParams.fullName ?? "",
          phone: searchParams.phone ?? "",
          email: searchParams.email ?? "",
        }}
        submitLabel="Create tenant"
        cancelHref={
          fromInquiry ? `/inquiries/${searchParams.fromInquiry}` : "/tenants"
        }
        includePassword
      />
    </div>
  );
}
