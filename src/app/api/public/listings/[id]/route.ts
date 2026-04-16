import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
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
  });
}
