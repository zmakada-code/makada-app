import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { TenantForm } from "@/components/TenantForm";
import { updateTenant, type TenantFormState } from "@/lib/actions/tenants";

export default async function EditTenantPage({
  params,
}: {
  params: { id: string };
}) {
  const tenant = await prisma.tenant.findUnique({ where: { id: params.id } });
  if (!tenant) notFound();

  async function action(prev: TenantFormState, formData: FormData) {
    "use server";
    return updateTenant(params.id, prev, formData);
  }

  return (
    <div>
      <PageHeader title="Edit tenant" description={tenant.fullName} />
      <TenantForm
        action={action}
        initial={{
          fullName: tenant.fullName,
          phone: tenant.phone,
          email: tenant.email,
          notes: tenant.notes,
          turbotenantReference: tenant.turbotenantReference,
        }}
        submitLabel="Save changes"
        cancelHref={`/tenants/${tenant.id}`}
      />
    </div>
  );
}
