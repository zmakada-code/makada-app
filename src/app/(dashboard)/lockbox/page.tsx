import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { Flash } from "@/components/Flash";
import { LockboxManager } from "./LockboxManager";

export const dynamic = "force-dynamic";

export default async function LockboxPage() {
  const properties = await prisma.property.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      address: true,
      lockboxCodes: { orderBy: { createdAt: "asc" } },
      units: {
        orderBy: { label: "asc" },
        select: {
          id: true,
          label: true,
          smartLockCodes: { orderBy: { createdAt: "asc" } },
        },
      },
      tempAccessCodes: {
        orderBy: { expiresAt: "asc" },
      },
    },
  });

  return (
    <div>
      <Flash />
      <PageHeader
        title="Lockbox & Code Manager"
        description="Manage lockbox codes, smart lock codes, and temporary access for all properties."
      />
      <LockboxManager properties={properties} />
    </div>
  );
}
