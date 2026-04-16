import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
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
}
