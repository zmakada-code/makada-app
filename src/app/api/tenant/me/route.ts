import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/tenant/me?email=tenant@example.com
 * Returns the tenant's profile, active lease, unit, and property info.
 *
 * Auth: x-intake-secret header (server-to-server only, called by Replit backend).
 */
export async function GET(request: Request) {
  const secret = request.headers.get("x-intake-secret");
  if (!secret || secret !== process.env.INQUIRY_INTAKE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const email = url.searchParams.get("email")?.trim()?.toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Email param is required." }, { status: 400 });
  }

  const tenant = await prisma.tenant.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  // Get active lease with unit and property info
  const activeLease = await prisma.lease.findFirst({
    where: { tenantId: tenant.id, status: "ACTIVE" },
    include: {
      unit: {
        include: { property: true },
      },
    },
  });

  // Get all leases for history
  const leases = await prisma.lease.findMany({
    where: { tenantId: tenant.id },
    include: {
      unit: {
        include: { property: true },
      },
    },
    orderBy: { startDate: "desc" },
  });

  // Get maintenance tickets for this tenant
  const tickets = await prisma.maintenanceTicket.findMany({
    where: { tenantId: tenant.id },
    include: {
      unit: { include: { property: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get documents linked to the tenant's unit(s) or tenant directly
  const unitIds = leases.map((l) => l.unit.id);
  const documents = await prisma.document.findMany({
    where: {
      OR: [
        { linkedEntityType: "UNIT", linkedEntityId: { in: unitIds } },
        { linkedEntityType: "TENANT", linkedEntityId: tenant.id },
        ...leases.map((l) => ({ linkedEntityType: "LEASE" as const, linkedEntityId: l.id })),
      ],
    },
    orderBy: { uploadedAt: "desc" },
  });

  // Generate signed URLs for documents
  const { getSignedDocumentUrl } = await import("@/lib/supabase/admin");
  const docsWithUrls = await Promise.all(
    documents.map(async (d) => {
      const signedUrl = await getSignedDocumentUrl(d.storagePath, 60 * 60); // 1 hour
      return {
        id: d.id,
        filename: d.filename,
        type: d.type,
        uploadedAt: d.uploadedAt,
        url: signedUrl,
      };
    })
  );

  return NextResponse.json({
    tenant: {
      id: tenant.id,
      fullName: tenant.fullName,
      email: tenant.email,
      phone: tenant.phone,
    },
    activeLease: activeLease
      ? {
          id: activeLease.id,
          startDate: activeLease.startDate,
          endDate: activeLease.endDate,
          monthlyRent: activeLease.monthlyRent,
          status: activeLease.status,
          unit: {
            id: activeLease.unit.id,
            label: activeLease.unit.label,
            bedrooms: activeLease.unit.bedrooms,
            bathrooms: activeLease.unit.bathrooms,
          },
          property: {
            id: activeLease.unit.property.id,
            name: activeLease.unit.property.name,
            address: activeLease.unit.property.address,
          },
        }
      : null,
    leases: leases.map((l) => ({
      id: l.id,
      startDate: l.startDate,
      endDate: l.endDate,
      monthlyRent: l.monthlyRent,
      status: l.status,
      unitLabel: l.unit.label,
      propertyName: l.unit.property.name,
    })),
    tickets: tickets.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
      createdAt: t.createdAt,
      resolvedAt: t.resolvedAt,
      unitLabel: t.unit.label,
      propertyName: t.unit.property.name,
    })),
    documents: docsWithUrls,
  });
}
