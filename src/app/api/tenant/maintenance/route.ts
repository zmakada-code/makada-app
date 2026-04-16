import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/tenant/maintenance
 *
 * Tenant-facing endpoint for submitting maintenance requests from the
 * Replit portal. Authenticated via x-intake-secret header.
 *
 * Body: { email, title, description?, priority? }
 *
 * Looks up the tenant by email, finds their active lease to determine
 * the unit, and creates a MaintenanceTicket.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-intake-secret");
  if (!secret || secret !== process.env.INQUIRY_INTAKE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const email = body.email?.trim()?.toLowerCase();
  const title = body.title?.trim();
  const description = body.description?.trim() || null;
  const priority = body.priority?.toUpperCase() || "MEDIUM";

  if (!email || !title) {
    return NextResponse.json(
      { error: "email and title are required." },
      { status: 400 }
    );
  }

  const validPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
  if (!validPriorities.includes(priority)) {
    return NextResponse.json(
      { error: `priority must be one of: ${validPriorities.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    // Find the tenant by email
    const tenant = await prisma.tenant.findFirst({
      where: { email },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant not found." },
        { status: 404 }
      );
    }

    // Find their active lease to determine the unit
    const activeLease = await prisma.lease.findFirst({
      where: { tenantId: tenant.id, status: "ACTIVE" },
      select: { unitId: true },
    });

    if (!activeLease) {
      return NextResponse.json(
        { error: "No active lease found for this tenant." },
        { status: 400 }
      );
    }

    const ticket = await prisma.maintenanceTicket.create({
      data: {
        unitId: activeLease.unitId,
        tenantId: tenant.id,
        title,
        description,
        priority: priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
        status: "OPEN",
      },
    });

    return NextResponse.json(
      { ok: true, ticketId: ticket.id },
      { status: 201 }
    );
  } catch (err) {
    console.error("[tenant/maintenance] Error:", err);
    return NextResponse.json(
      { error: "Failed to create ticket." },
      { status: 500 }
    );
  }
}
