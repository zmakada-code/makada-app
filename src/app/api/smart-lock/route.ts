import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** POST /api/smart-lock — create or update a smart lock code */
export async function POST(req: NextRequest) {
  try {
    const { id, unitId, label, code, expiresAt, notes } = await req.json();

    if (!unitId || !code || !label) {
      return NextResponse.json(
        { error: "unitId, label, and code are required" },
        { status: 400 }
      );
    }

    const data = {
      label,
      code,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      notes: notes ?? null,
      isActive: true,
    };

    if (id) {
      const updated = await prisma.smartLockCode.update({
        where: { id },
        data,
      });
      return NextResponse.json({ smartLock: updated });
    }

    const created = await prisma.smartLockCode.create({
      data: { unitId, ...data },
    });
    return NextResponse.json({ smartLock: created });
  } catch (err) {
    console.error("[smart-lock] error:", err);
    return NextResponse.json({ error: "Failed to save smart lock code" }, { status: 500 });
  }
}

/** PATCH /api/smart-lock — revoke (deactivate) a smart lock code */
export async function PATCH(req: NextRequest) {
  try {
    const { id, isActive } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const updated = await prisma.smartLockCode.update({
      where: { id },
      data: { isActive: isActive ?? false },
    });
    return NextResponse.json({ smartLock: updated });
  } catch (err) {
    console.error("[smart-lock] patch error:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

/** DELETE /api/smart-lock?id=xxx */
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await prisma.smartLockCode.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[smart-lock] delete error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
