import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * PATCH /api/zillow-rentals/[id]
 * Update listing fields: description, zillowUrl, isPublished
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (typeof body.description === "string") {
      data.publicDescription = body.description;
    }
    if (typeof body.zillowUrl === "string") {
      data.zillowUrl = body.zillowUrl || null;
    }
    if (typeof body.isPublished === "boolean") {
      data.isPublished = body.isPublished;
    }

    const unit = await prisma.unit.update({
      where: { id: params.id },
      data,
    });

    // Revalidate relevant pages
    revalidatePath("/zillow-rentals");
    revalidatePath(`/zillow-rentals/${params.id}`);
    revalidatePath("/api/public/listings");

    return NextResponse.json({ ok: true, isPublished: unit.isPublished });
  } catch (err) {
    console.error("[zillow-rentals] PATCH error:", err);
    return NextResponse.json(
      { error: "Failed to update listing" },
      { status: 500 }
    );
  }
}
