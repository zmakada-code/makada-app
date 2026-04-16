import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    console.log(
      `[listings] DATABASE_URL host: ${(process.env.DATABASE_URL ?? "").split("@")[1]?.split("/")[0] ?? "NOT SET"}`,
      `| found ${units.length} published vacant units`
    );

    const data = units.map((unit) => ({
      id: unit.id,
      propertyName: unit.property.name,
      address: unit.property.address,
      unitLabel: unit.label,
      bedrooms: unit.bedrooms,
      bathrooms: unit.bathrooms,
      rentAmount: unit.rentAmount,
      depositAmount: unit.depositAmount,
      description: unit.publicDescription ?? "",
    }));

    return NextResponse.json(data);
  } catch (err) {
    console.error("[listings] DB error:", err);
    return NextResponse.json(
      { error: "Failed to fetch listings", detail: String(err) },
      { status: 500 }
    );
  }
}
