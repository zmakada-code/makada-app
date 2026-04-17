import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSignedDocumentUrl } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const unit = await prisma.unit.findFirst({
      where: {
        id: params.id,
        isPublished: true,
        occupancyStatus: "VACANT",
      },
      include: {
        property: true,
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let propertyImageUrl: string | null = null;
    if (unit.property.imageUrl) {
      propertyImageUrl = await getSignedDocumentUrl(
        unit.property.imageUrl,
        60 * 60 * 24
      );
    }

    return NextResponse.json({
      id: unit.id,
      propertyName: unit.property.name,
      address: unit.property.address,
      unitLabel: unit.label,
      bedrooms: unit.bedrooms,
      bathrooms: unit.bathrooms,
      rentAmount: unit.rentAmount,
      depositAmount: unit.depositAmount,
      description: unit.publicDescription ?? "",
      propertyImageUrl,
    });
  } catch (err) {
    console.error("[listings/:id] DB error:", err);
    return NextResponse.json(
      { error: "Failed to fetch listing", detail: String(err) },
      { status: 500 }
    );
  }
}
