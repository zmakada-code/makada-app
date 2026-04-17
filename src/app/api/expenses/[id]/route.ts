import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: params.id },
      include: {
        property: { select: { id: true, name: true } },
        unit: { select: { id: true, label: true } },
      },
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json({ expense });
  } catch (err) {
    console.error("Expense GET error:", err);
    return NextResponse.json({ error: "Failed to fetch expense" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { propertyId, unitId, category, vendor, description, amount, date, reference, note } =
      await req.json();

    if (!propertyId || !description || !amount || !date) {
      return NextResponse.json(
        { error: "propertyId, description, amount, and date are required" },
        { status: 400 }
      );
    }

    const expense = await prisma.expense.update({
      where: { id: params.id },
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
    console.error("Expense PUT error:", err);
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.expense.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Expense DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}
