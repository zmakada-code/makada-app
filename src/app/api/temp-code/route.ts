import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** POST /api/temp-code — create or update a temporary access code */
export async function POST(req: NextRequest) {
  try {
    const { id, propertyId, unitId, code, issuedTo, reason, expiresAt } = await req.json();

    if (!propertyId || !code || !issuedTo || !expiresAt) {
      return NextResponse.json(
        { error: "propertyId, code, issuedTo, and expiresAt are required" },
        { status: 400 }
      );
    }

    const data = {
      code,
      issuedTo,
      reason: reason ?? null,
      expiresAt: new Date(expiresAt),
      unitId: unitId || null,
      isActive: true,
    };

    if (id) {
      const updated = await prisma.tempAccessCode.update({
        where: { id },
        data,
      });
      return NextResponse.json({ tempCode: updated });
    }

    const created = await prisma.tempAccessCode.create({
      data: { propertyId, ...data },
    });
    return NextResponse.json({ tempCode: created });
  } catch (err) {
    console.error("[temp-code] error:", err);
    return NextResponse.json({ error: "Failed to save temp code" }, { status: 500 });
  }
}

/** PATCH /api/temp-code — revoke a temp code */
export async function PATCH(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const updated = await prisma.tempAccessCode.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ tempCode: updated });
  } catch (err) {
    console.error("[temp-code] patch error:", err);
    return NextResponse.json({ error: "Failed to revoke" }, { status: 500 });
  }
}

/** DELETE /api/temp-code?id=xxx */
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await prisma.tempAccessCode.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[temp-code] delete error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
