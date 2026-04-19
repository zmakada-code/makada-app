import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/properties/set-photos
 *
 * One-time endpoint to set property photos from the local
 * public/property-photos folder. Maps property names to photo files.
 */
const PHOTO_MAP: Record<string, string> = {
  "Circle Court": "/property-photos/Circle Court.png",
  "Railroad Avenue": "/property-photos/Railroad.png",
  "Humbolt Street": "/property-photos/N Humboldt.png",
  "Lakeview Way": "/property-photos/303 Lakeview Way.jpg",
  "500 N San Mateo": "/property-photos/500 N San Mateo.png",
  "1110 Haddon Drive": "/property-photos/Haddon.jpg",
};

export async function POST() {
  try {
    const results: string[] = [];

    for (const [name, photoPath] of Object.entries(PHOTO_MAP)) {
      const property = await prisma.property.findFirst({
        where: { name: { contains: name, mode: "insensitive" } },
      });

      if (!property) {
        results.push(`⚠️ Property "${name}" not found`);
        continue;
      }

      await prisma.property.update({
        where: { id: property.id },
        data: { imageUrl: photoPath },
      });

      results.push(`✅ ${name} → ${photoPath}`);
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error("[set-photos] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
