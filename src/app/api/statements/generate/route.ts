import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { randomUUID } from "crypto";
import { createSupabaseAdminClient, DOCUMENTS_BUCKET } from "@/lib/supabase/admin";

/**
 * POST /api/statements/generate
 * Auto-generates owner statements for all properties for a given month.
 * Stores PDFs in Supabase Storage and creates Document records.
 * Can also be called for a specific property.
 *
 * Body: { month: "2026-04", propertyId?: string }
 *
 * Also supports: ?cron=true&secret=xxx for scheduled auto-generation
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const month = body.month;
    const specificPropertyId = body.propertyId;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "month is required (YYYY-MM format)" }, { status: 400 });
    }

    const properties = specificPropertyId
      ? await prisma.property.findMany({ where: { id: specificPropertyId } })
      : await prisma.property.findMany();

    if (properties.length === 0) {
      return NextResponse.json({ error: "No properties found" }, { status: 404 });
    }

    const [year, mo] = month.split("-").map(Number);
    const startDate = new Date(year, mo - 1, 1);
    const endDate = new Date(year, mo, 0, 23, 59, 59);
    const periodLabel = startDate.toLocaleString("en-US", { month: "long", year: "numeric" });

    const results = [];

    for (const property of properties) {
      // Check if statement already exists for this property/month
      const existingDoc = await prisma.document.findFirst({
        where: {
          type: "OTHER",
          linkedEntityType: "PROPERTY",
          linkedEntityId: property.id,
          filename: { contains: `statement-${month}` },
        },
      });
      if (existingDoc) {
        results.push({ property: property.name, status: "already exists", docId: existingDoc.id });
        continue;
      }

      // Get payments
      const payments = await prisma.paymentStatus.findMany({
        where: {
          period: month,
          status: "PAID",
          lease: { unit: { propertyId: property.id } },
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

      // Get expenses
      const expenses = await prisma.expense.findMany({
        where: {
          propertyId: property.id,
          date: { gte: startDate, lte: endDate },
        },
        include: { unit: { select: { label: true } } },
        orderBy: { date: "asc" },
      });

      const totalIncome = payments.reduce((sum, p) => {
        return sum + (p.amountPaid ? Number(p.amountPaid) : Number(p.lease.unit.rentAmount));
      }, 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
      const netIncome = totalIncome - totalExpenses;

      // Generate PDF
      const pdfBytes = await generateStatementPdf(property, payments, expenses, totalIncome, totalExpenses, netIncome, periodLabel, month);

      // Upload to Supabase
      const supabase = createSupabaseAdminClient();
      const filename = `statement-${month}-${property.name.replace(/\s+/g, "-")}.pdf`;
      const storagePath = `property/${property.id}/${randomUUID()}-${filename}`;

      const { error: uploadError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(storagePath, Buffer.from(pdfBytes), { contentType: "application/pdf", upsert: false });

      if (uploadError) {
        results.push({ property: property.name, status: "upload failed", error: uploadError.message });
        continue;
      }

      // Create Document record
      const doc = await prisma.document.create({
        data: {
          filename,
          fileUrl: "",
          storagePath,
          type: "OTHER",
          linkedEntityType: "PROPERTY",
          linkedEntityId: property.id,
        },
      });

      results.push({
        property: property.name,
        status: "generated",
        docId: doc.id,
        totalIncome,
        totalExpenses,
        netIncome,
      });
    }

    return NextResponse.json({ month, results });
  } catch (err) {
    console.error("Statement generation error:", err);
    return NextResponse.json({ error: "Failed to generate statements" }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateStatementPdf(property: any, payments: any[], expenses: any[], totalIncome: number, totalExpenses: number, netIncome: number, periodLabel: string, month: string): Promise<Uint8Array> {
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
  const leftMargin = 50;
  const rightMargin = 562;

  let y = 720;

  function checkNewPage() {
    if (y < 80) { page = pdf.addPage([612, 792]); y = 720; }
  }

  function drawMoney(amount: number, x: number, yPos: number, isBold = false) {
    const text = `$${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
    page.drawText(amount < 0 ? `-${text}` : text, { x, y: yPos, font: isBold ? fontBold : font, size: 9, color: amount < 0 ? red : dark });
  }

  // Header
  page.drawText("Owner Statement", { x: leftMargin, y, font: fontBold, size: 22, color: dark });
  y -= 25;
  page.drawText("MZAN Capital", { x: leftMargin, y, font: fontBold, size: 11, color: accent });
  page.drawText(`Period: ${periodLabel}`, { x: 400, y, font, size: 11, color: muted });

  y -= 30;
  page.drawText("MZAN Capital", { x: leftMargin, y, font: fontBold, size: 10, color: dark });
  y -= 14;
  page.drawText("500 Airport Blvd, Suite 500", { x: leftMargin, y, font, size: 9, color: muted });
  y -= 12;
  page.drawText("Burlingame, CA 94010", { x: leftMargin, y, font, size: 9, color: muted });

  const propY = y + 26;
  page.drawText("Property", { x: 400, y: propY, font: fontBold, size: 10, color: dark });
  page.drawText(property.name, { x: 400, y: propY - 14, font, size: 9, color: muted });
  page.drawText(property.address, { x: 400, y: propY - 26, font, size: 9, color: muted });

  y -= 30;
  page.drawLine({ start: { x: leftMargin, y }, end: { x: rightMargin, y }, thickness: 1, color: rgb(0.85, 0.87, 0.9) });

  // ── SUMMARY ──
  y -= 25;
  page.drawText("Summary", { x: leftMargin, y, font: fontBold, size: 13, color: dark });
  y -= 20;
  page.drawText("Gross Income:", { x: leftMargin + 5, y, font, size: 10, color: muted });
  drawMoney(totalIncome, 200, y, true);
  y -= 16;
  page.drawText("Total Expenses:", { x: leftMargin + 5, y, font, size: 10, color: muted });
  drawMoney(totalExpenses, 200, y, true);
  y -= 16;
  page.drawText("Net Income:", { x: leftMargin + 5, y, font: fontBold, size: 10, color: dark });
  const netText = `$${Math.abs(netIncome).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  page.drawText(netIncome < 0 ? `-${netText}` : netText, { x: 200, y, font: fontBold, size: 10, color: netIncome >= 0 ? green : red });

  y -= 30;
  page.drawLine({ start: { x: leftMargin, y }, end: { x: rightMargin, y }, thickness: 1, color: rgb(0.85, 0.87, 0.9) });

  // ── INCOME ──
  y -= 25;
  page.drawText("Income Detail", { x: leftMargin, y, font: fontBold, size: 13, color: dark });
  y -= 18;

  page.drawRectangle({ x: leftMargin, y: y - 2, width: rightMargin - leftMargin, height: 16, color: lightBg });
  page.drawText("Date", { x: leftMargin + 5, y: y + 2, font: fontBold, size: 8, color: muted });
  page.drawText("Tenant", { x: 130, y: y + 2, font: fontBold, size: 8, color: muted });
  page.drawText("Unit", { x: 300, y: y + 2, font: fontBold, size: 8, color: muted });
  page.drawText("Method", { x: 370, y: y + 2, font: fontBold, size: 8, color: muted });
  page.drawText("Amount", { x: 510, y: y + 2, font: fontBold, size: 8, color: muted });
  y -= 18;

  if (payments.length === 0) {
    page.drawText("No rent income recorded.", { x: leftMargin + 5, y, font, size: 9, color: muted });
    y -= 16;
  } else {
    for (const p of payments) {
      checkNewPage();
      const amt = p.amountPaid ? Number(p.amountPaid) : Number(p.lease.unit.rentAmount);
      const dateStr = p.paidAt ? new Date(p.paidAt).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }) : "—";
      const method = p.method === "ONLINE" ? "Stripe" : p.method === "CHECK" ? "Check" : p.method === "CASH" ? "Cash" : p.method || "—";

      page.drawText(dateStr, { x: leftMargin + 5, y, font, size: 9, color: dark });
      page.drawText(p.lease.tenant.fullName, { x: 130, y, font, size: 9, color: dark });
      page.drawText(p.lease.unit.label, { x: 300, y, font, size: 9, color: dark });
      page.drawText(method, { x: 370, y, font, size: 9, color: dark });
      drawMoney(amt, 510, y);
      y -= 16;
    }
  }

  y -= 5;
  page.drawLine({ start: { x: 480, y: y + 8 }, end: { x: rightMargin, y: y + 8 }, thickness: 0.5, color: rgb(0.85, 0.87, 0.9) });
  page.drawText("Total Income", { x: leftMargin + 5, y, font: fontBold, size: 10, color: dark });
  drawMoney(totalIncome, 510, y, true);

  // ── EXPENSES ──
  y -= 35;
  checkNewPage();
  page.drawText("Expense Detail", { x: leftMargin, y, font: fontBold, size: 13, color: dark });
  y -= 18;

  page.drawRectangle({ x: leftMargin, y: y - 2, width: rightMargin - leftMargin, height: 16, color: lightBg });
  page.drawText("Date", { x: leftMargin + 5, y: y + 2, font: fontBold, size: 8, color: muted });
  page.drawText("Vendor", { x: 130, y: y + 2, font: fontBold, size: 8, color: muted });
  page.drawText("Category", { x: 260, y: y + 2, font: fontBold, size: 8, color: muted });
  page.drawText("Description", { x: 370, y: y + 2, font: fontBold, size: 8, color: muted });
  page.drawText("Amount", { x: 510, y: y + 2, font: fontBold, size: 8, color: muted });
  y -= 18;

  if (expenses.length === 0) {
    page.drawText("No expenses recorded.", { x: leftMargin + 5, y, font, size: 9, color: muted });
    y -= 16;
  } else {
    for (const e of expenses) {
      checkNewPage();
      const dateStr = new Date(e.date).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
      const desc = e.description.length > 25 ? e.description.slice(0, 25) + "…" : e.description;
      const cat = (e.category || "OTHER").replace(/_/g, " ");

      page.drawText(dateStr, { x: leftMargin + 5, y, font, size: 9, color: dark });
      page.drawText(e.vendor || "—", { x: 130, y, font, size: 9, color: dark });
      page.drawText(cat, { x: 260, y, font, size: 8, color: muted });
      page.drawText(desc, { x: 370, y, font, size: 9, color: dark });
      drawMoney(Number(e.amount), 510, y);
      y -= 16;
    }
  }

  y -= 5;
  page.drawLine({ start: { x: 480, y: y + 8 }, end: { x: rightMargin, y: y + 8 }, thickness: 0.5, color: rgb(0.85, 0.87, 0.9) });
  page.drawText("Total Expenses", { x: leftMargin + 5, y, font: fontBold, size: 10, color: dark });
  drawMoney(totalExpenses, 510, y, true);

  // ── NET ──
  y -= 30;
  checkNewPage();
  page.drawLine({ start: { x: leftMargin, y: y + 8 }, end: { x: rightMargin, y: y + 8 }, thickness: 2, color: accent });
  page.drawText("Net Income", { x: leftMargin + 5, y: y - 8, font: fontBold, size: 14, color: dark });
  page.drawText(netIncome < 0 ? `-${netText}` : netText, { x: 500, y: y - 8, font: fontBold, size: 14, color: netIncome >= 0 ? green : red });

  const footerY = 40;
  page.drawText("Generated by MZAN Capital", { x: leftMargin, y: footerY, font, size: 8, color: muted });
  page.drawText(new Date().toLocaleDateString("en-US"), { x: 490, y: footerY, font, size: 8, color: muted });

  return pdf.save();
}
