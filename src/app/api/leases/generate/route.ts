import { NextResponse } from "next/server";
import { generateLease, leaseFilename, type LeaseInput } from "@/lib/lease-generator";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * POST /api/leases/generate
 *
 * Two modes:
 *   1. { leaseId: "xxx" } — auto-fill from existing lease/tenant/unit data
 *   2. { data: LeaseInput } — use provided values directly
 *
 * Query params:
 *   ?save=true — also upload to Supabase Storage and create a Document record
 *
 * Returns the generated .docx file as a download.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = new URL(request.url);
    const save = url.searchParams.get("save") === "true";

    let input: LeaseInput;

    if (body.leaseId) {
      // Auto-fill from database
      input = await buildInputFromLease(body.leaseId);
    } else if (body.data) {
      input = body.data as LeaseInput;
    } else {
      return NextResponse.json(
        { error: "Provide either leaseId or data" },
        { status: 400 }
      );
    }

    // Allow overrides on top of auto-filled data
    if (body.overrides) {
      Object.assign(input, body.overrides);
    }

    const buffer = await generateLease(input);
    const filename = leaseFilename(input);

    // Optionally save to Supabase Storage and create Document record
    if (save && body.leaseId) {
      const lease = await prisma.lease.findUnique({
        where: { id: body.leaseId },
        select: { id: true, unitId: true },
      });
      if (lease) {
        const supabase = createSupabaseAdminClient();
        const storagePath = `lease/${lease.id}/${crypto.randomUUID()}-${filename}`;

        await supabase.storage.from("documents").upload(storagePath, buffer, {
          contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          upsert: false,
        });

        await prisma.document.create({
          data: {
            filename,
            fileUrl: "",
            storagePath,
            type: "LEASE",
            linkedEntityType: "LEASE",
            linkedEntityId: lease.id,
          },
        });
      }
    }

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[lease-generate] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/leases/generate?leaseId=xxx
 * Returns the pre-filled input data for a lease (for the UI to show editable fields).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const leaseId = url.searchParams.get("leaseId");

    if (!leaseId) {
      return NextResponse.json({ error: "leaseId required" }, { status: 400 });
    }

    const input = await buildInputFromLease(leaseId);
    return NextResponse.json(input);
  } catch (err) {
    console.error("[lease-generate] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

async function buildInputFromLease(leaseId: string): Promise<LeaseInput> {
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: {
      tenant: true,
      unit: { include: { property: true } },
    },
  });

  if (!lease) throw new Error("Lease not found");

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  // Get initials from tenant name
  const nameParts = lease.tenant.fullName.split(" ");
  const initials =
    nameParts.length >= 2
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      : nameParts[0]?.substring(0, 2).toUpperCase() || "";

  return {
    TENANT_1_NAME: lease.tenant.fullName,
    TENANT_2_NAME: "", // second tenant — user can fill in
    PROPERTY_ADDRESS: lease.unit.property.address,
    UNIT_NUMBER: lease.unit.label,
    BEDROOM_COUNT: String(lease.unit.bedrooms),
    BATHROOM_COUNT: String(lease.unit.bathrooms),
    RENT_AMOUNT: `$${Number(lease.monthlyRent).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    SECURITY_DEPOSIT: `$${Number(lease.unit.depositAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    START_DATE: formatDate(lease.startDate),
    END_DATE: formatDate(lease.endDate),
    EFFECTIVE_DATE: formatDate(lease.startDate),
    PARKING_SPACE: "As assigned by management",
    STORAGE_DESCRIPTION: "",
    TENANT_1_INITIALS: initials,
    TENANT_2_INITIALS: "",
    TENANT_1_SIGN_DATE: "",
    TENANT_2_SIGN_DATE: "",
  };
}
