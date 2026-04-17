import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { propertyId, unitId, category, vendor, description, amount, date, reference, note } = await req.json();

    if (!propertyId || !description || !amount || !date) {
      return NextResponse.json({ error: "propertyId, description, amount, and date are required" }, { status: 400 });
    }

    const expense = await prisma.expense.create({
      data: {
        propertyId,
        unitId: unitId || null,
        category: category || "OTHER",
        vendor: vendor || null,
        description,
        amount,
        date: new Date(date),
        reference: reference || null,
        note: note || null,
      },
    });

    return NextResponse.json({ expense });
  } catch (err) {
    console.error("Expense creation error:", err);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}
