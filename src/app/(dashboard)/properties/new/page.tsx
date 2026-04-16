import { PageHeader } from "@/components/PageHeader";
import { PropertyForm } from "@/components/PropertyForm";
import { createProperty } from "@/lib/actions/properties";

export default function NewPropertyPage() {
  return (
    <div>
      <PageHeader title="Add property" description="Create a new property record." />
      <PropertyForm action={createProperty} submitLabel="Create property" cancelHref="/properties" />
    </div>
  );
}
