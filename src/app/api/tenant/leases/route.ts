import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSignedDocumentUrl } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/tenant/leases?email=tenant@example.com
 *
 * Returns all leases for a tenant, including signing status and document URLs.
 * Auth: x-intake-secret header (server-to-server from Replit backend)
 */
export async function GET(request: Request) {
  const secret = request.headers.get("x-intake-secret");
  if (!secret || secret !== process.env.INQUIRY_INTAKE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const email = url.searchParams.get("email")?.trim()?.toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Email param is required" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const leases = await prisma.lease.findMany({
    where: { tenantId: tenant.id },
    include: {
      unit: { include: { property: true } },
    },
    orderBy: { startDate: "desc" },
  });

  // Build response with signed URLs for lease documents
  const leasesWithDocs = await Promise.all(
    leases.map(async (l) => {
      let leaseDocUrl: string | null = null;
      let signedDocUrl: string | null = null;

      if (l.leaseDocStoragePath) {
        leaseDocUrl = await getSignedDocumentUrl(l.leaseDocStoragePath, 60 * 60);
      }
      if (l.signedDocStoragePath) {
        signedDocUrl = await getSignedDocumentUrl(l.signedDocStoragePath, 60 * 60);
      }

      return {
        id: l.id,
        startDate: l.startDate,
        endDate: l.endDate,
        monthlyRent: l.monthlyRent,
        leaseType: l.leaseType,
        status: l.status,
        signingStatus: l.signingStatus || null,
        sentForSigningAt: l.sentForSigningAt || null,
        signedAt: l.signedAt || null,
        leaseDocUrl,
        signedDocUrl,
        unit: {
          id: l.unit.id,
          label: l.unit.label,
          bedrooms: l.unit.bedrooms,
          bathrooms: l.unit.bathrooms,
        },
        property: {
          id: l.unit.property.id,
          name: l.unit.property.name,
          address: l.unit.property.address,
        },
      };
    })
  );

  return NextResponse.json({
    tenant: {
      id: tenant.id,
      fullName: tenant.fullName,
      email: tenant.email,
    },
    leases: leasesWithDocs,
  });
}
