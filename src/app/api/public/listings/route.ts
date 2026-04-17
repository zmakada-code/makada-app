import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSignedDocumentUrl } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const units = await prisma.unit.findMany({
      where: {
        isPublished: true,
        occupancyStatus: "VACANT",
      },
      include: {
        property: true,
      },
      orderBy: [
        { property: { name: "asc" } },
        { label: "asc" },
      ],
    });

    // Resolve signed URLs for property images
    const data = await Promise.all(
      units.map(async (unit) => {
        let propertyImageUrl: string | null = null;
        if (unit.property.imageUrl) {
          propertyImageUrl = await getSignedDocumentUrl(
            unit.property.imageUrl,
            60 * 60 * 24 // 24 hours
          );
        }
        return {
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
        };
      })
    );

    return NextResponse.json(data);
  } catch (err) {
    console.error("[listings] DB error:", err);
    return NextResponse.json(
      { error: "Failed to fetch listings", detail: String(err) },
      { status: 500 }
    );
  }
}
