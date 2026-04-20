import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

/**
 * GET /api/statements?propertyId=xxx&month=2026-04
 * Generates a per-property owner statement PDF for a given month.
 * Shows all income (rent payments) and expenses for that property/period.
 */
export async function GET(req: NextRequest) {
  const propertyId = req.nextUrl.searchParams.get("propertyId");
  const month = req.nextUrl.searchParams.get("month"); // e.g. "2026-04"

  if (!propertyId || !month) {
    return NextResponse.json({ error: "propertyId and month are required" }, { status: 400 });
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });
  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  // Parse month range
  const [year, mo] = month.split("-").map(Number);
  const startDate = new Date(year, mo - 1, 1);
  const endDate = new Date(year, mo, 0, 23, 59, 59); // last day of month

  const periodLabel = startDate.toLocaleString("en-US", { month: "long", year: "numeric" });

  // Get rent payments for this period
  const payments = await prisma.paymentStatus.findMany({
    where: {
      period: month,
      status: "PAID",
      lease: {
        unit: { propertyId },
      },
    },
    include: {
      lease: {
        include: {
          tenant: { select: { fullName: true } },
          unit: { select: { label: true, rentAmount: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Get expenses for this period
  const expenses = await prisma.expense.findMany({
    where: {
      propertyId,
      date: { gte: startDate, lte: endDate },
    },
    include: {
      unit: { select: { label: true } },
    },
    orderBy: { date: "asc" },
  });

  // Totals
  const totalIncome = payments.reduce((sum, p) => {
    const amt = p.amountPaid ? Number(p.amountPaid) : Number(p.lease.unit.rentAmount);
    return sum + amt;
  }, 0);

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const netIncome = totalIncome - totalExpenses;

  // Build PDF
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const dark = rgb(0.06, 0.09, 0.16);
  const muted = rgb(0.4, 0.45, 0.55);
  const accent = rgb(0.31, 0.27, 0.9);
  const green = rgb(0.1, 0.5, 0.2);
  const red = rgb(0.7, 0.15, 0.15);
  const lightBg = rgb(0.96, 0.97, 0.98);

  let y = 720;
  const leftMargin = 50;
  const rightMargin = 562;

  function checkNewPage() {
    if (y < 80) {
      page = pdf.addPage([612, 792]);
      y = 720;
    }
  }

  function drawMoney(amount: number, x: number, yPos: number, isBold = false) {
    const text = `$${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
    const color = amount < 0 ? red : dark;
    page.drawText(text, { x, y: yPos, font: isBold ? fontBold : font, size: 9, color });
  }

  // Header
  page.drawText("Owner Statement", { x: leftMargin, y, font: fontBold, size: 22, color: dark });
  y -= 25;
  page.drawText("MZAN Capital", { x: leftMargin, y, font: fontBold, size: 11, color: accent });
  page.drawText(`Period: ${periodLabel}`, { x: 400, y, font, size: 11, color: muted });

  y -= 30;
  // Owner info
  page.drawText("MZAN Capital", { x: leftMargin, y, font: fontBold, size: 10, color: dark });
  y -= 14;
  page.drawText("500 Airport Blvd, Suite 500", { x: leftMargin, y, font, size: 9, color: muted });
  y -= 12;
  page.drawText("Burlingame, CA 94010", { x: leftMargin, y, font, size: 9, color: muted });

  // Property info (right side)
  const propY = y + 26;
  page.drawText("Property", { x: 400, y: propY, font: fontBold, size: 10, color: dark });
  page.drawText(property.name, { x: 400, y: propY - 14, font, size: 9, color: muted });
  page.drawText(property.address, { x: 400, y: propY - 26, font, size: 9, color: muted });

  y -= 30;
  page.drawLine({ start: { x: leftMargin, y }, end: { x: rightMargin, y }, thickness: 1, color: rgb(0.85, 0.87, 0.9) });

  // ── INCOME SECTION ──
  y -= 25;
  page.drawText("Income", { x: leftMargin, y, font: fontBold, size: 13, color: dark });
  y -= 18;

  // Table header
  page.drawRectangle({ x: leftMargin, y: y - 2, width: rightMargin - leftMargin, height: 16, color: lightBg });
  page.drawText("Date", { x: leftMargin + 5, y: y + 2, font: fontBold, size: 8, color: muted });
  page.drawText("Tenant", { x: 130, y: y + 2, font: fontBold, size: 8, color: muted });
  page.drawText("Unit", { x: 300, y: y + 2, font: fontBold, size: 8, color: muted });
  page.drawText("Description", { x: 360, y: y + 2, font: fontBold, size: 8, color: muted });
  page.drawText("Amount", { x: 510, y: y + 2, font: fontBold, size: 8, color: muted });
  y -= 18;

  if (payments.length === 0) {
    page.drawText("No rent income recorded for this period.", { x: leftMargin + 5, y, font, size: 9, color: muted });
    y -= 16;
  } else {
    for (const p of payments) {
      checkNewPage();
      const amt = p.amountPaid ? Number(p.amountPaid) : Number(p.lease.unit.rentAmount);
      const dateStr = p.paidAt ? new Date(p.paidAt).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }) : "—";

      page.drawText(dateStr, { x: leftMargin + 5, y, font, size: 9, color: dark });
      page.drawText(p.lease.tenant.fullName, { x: 130, y, font, size: 9, color: dark });
      page.drawText(p.lease.unit.label, { x: 300, y, font, size: 9, color: dark });
      page.drawText("Rent", { x: 360, y, font, size: 9, color: dark });
      drawMoney(amt, 510, y);
      y -= 16;
    }
  }

  // Income total
  y -= 5;
  page.drawLine({ start: { x: 480, y: y + 8 }, end: { x: rightMargin, y: y + 8 }, thickness: 0.5, color: rgb(0.85, 0.87, 0.9) });
  page.drawText("Total Income", { x: leftMargin + 5, y, font: fontBold, size: 10, color: dark });
  drawMoney(totalIncome, 510, y, true);

  // ── EXPENSES SECTION ──
  y -= 35;
  checkNewPage();
  page.drawText("Expenses", { x: leftMargin, y, font: fontBold, size: 13, color: dark });
  y -= 18;

  // Table header
  page.drawRectangle({ x: leftMargin, y: y - 2, width: rightMargin - leftMargin, height: 16, color: lightBg });
  page.drawText("Date", { x: leftMargin + 5, y: y + 2, font: fontBold, size: 8, color: muted });
  page.drawText("Vendor", { x: 130, y: y + 2, font: fontBold, size: 8, color: muted });
  page.drawText("Description", { x: 280, y: y + 2, font: fontBold, size: 8, color: muted });
  page.drawText("Amount", { x: 510, y: y + 2, font: fontBold, size: 8, color: muted });
  y -= 18;

  if (expenses.length === 0) {
    page.drawText("No expenses recorded for this period.", { x: leftMargin + 5, y, font, size: 9, color: muted });
    y -= 16;
  } else {
    for (const e of expenses) {
      checkNewPage();
      const dateStr = new Date(e.date).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
      const desc = e.description.length > 35 ? e.description.slice(0, 35) + "…" : e.description;

      page.drawText(dateStr, { x: leftMargin + 5, y, font, size: 9, color: dark });
      page.drawText(e.vendor || "—", { x: 130, y, font, size: 9, color: dark });
      page.drawText(desc, { x: 280, y, font, size: 9, color: dark });
      drawMoney(Number(e.amount), 510, y);
      y -= 16;
    }
  }

  // Expense total
  y -= 5;
  page.drawLine({ start: { x: 480, y: y + 8 }, end: { x: rightMargin, y: y + 8 }, thickness: 0.5, color: rgb(0.85, 0.87, 0.9) });
  page.drawText("Total Expenses", { x: leftMargin + 5, y, font: fontBold, size: 10, color: dark });
  drawMoney(totalExpenses, 510, y, true);

  // ── NET INCOME ──
  y -= 30;
  checkNewPage();
  page.drawLine({ start: { x: leftMargin, y: y + 8 }, end: { x: rightMargin, y: y + 8 }, thickness: 2, color: accent });
  page.drawText("Net Income", { x: leftMargin + 5, y: y - 8, font: fontBold, size: 14, color: dark });
  const netText = `$${Math.abs(netIncome).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  page.drawText(netIncome < 0 ? `-${netText}` : netText, {
    x: 500,
    y: y - 8,
    font: fontBold,
    size: 14,
    color: netIncome >= 0 ? green : red,
  });

  // Footer
  const footerY = 40;
  page.drawText("Generated by MZAN Capital", { x: leftMargin, y: footerY, font, size: 8, color: muted });
  page.drawText(new Date().toLocaleDateString("en-US"), { x: 490, y: footerY, font, size: 8, color: muted });

  const pdfBytes = await pdf.save();
  const filename = `statement-${property.name.replace(/\s+/g, "-")}-${month}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
