import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** POST /api/lockbox — create or update a lockbox code */
export async function POST(req: NextRequest) {
  try {
    const { id, propertyId, label, code, notes } = await req.json();

    if (!propertyId || !code) {
      return NextResponse.json(
        { error: "propertyId and code are required" },
        { status: 400 }
      );
    }

    if (id) {
      // Update existing
      const updated = await prisma.lockboxCode.update({
        where: { id },
        data: { label: label || "Main lockbox", code, notes: notes ?? null },
      });
      return NextResponse.json({ lockbox: updated });
    }

    // Create new
    const created = await prisma.lockboxCode.create({
      data: {
        propertyId,
        label: label || "Main lockbox",
        code,
        notes: notes ?? null,
      },
    });
    return NextResponse.json({ lockbox: created });
  } catch (err) {
    console.error("[lockbox] error:", err);
    return NextResponse.json({ error: "Failed to save lockbox code" }, { status: 500 });
  }
}

/** DELETE /api/lockbox?id=xxx */
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await prisma.lockboxCode.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[lockbox] delete error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
