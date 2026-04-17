import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

/**
 * POST /api/documents/ai-upload
 * Accepts a PDF upload, uses Claude to analyze it, and auto-categorizes it
 * to the correct property/unit. Also extracts expense data if applicable.
 *
 * FormData: file (PDF), plus optional overrides: propertyId, unitId
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Read file content
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    // Get all properties and units for context
    const properties = await prisma.property.findMany({
      include: {
        units: { select: { id: true, label: true } },
      },
    });

    const propertyContext = properties.map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      units: p.units.map((u) => ({ id: u.id, label: u.label })),
    }));

    // Use Claude to analyze the document
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64 },
            },
            {
              type: "text",
              text: `Analyze this document and extract the following information. Return ONLY valid JSON, no other text.

Here are the properties in our system:
${JSON.stringify(propertyContext, null, 2)}

Return JSON with these fields:
{
  "documentType": "LEASE" | "INVOICE" | "TAX" | "INSURANCE" | "RECEIPT" | "NOTICE" | "RULES" | "OTHER",
  "propertyId": "best matching property ID from the list above, or null",
  "unitId": "best matching unit ID, or null",
  "description": "brief description of the document",
  "vendor": "vendor/payee name if this is a bill/invoice, or null",
  "amount": number or null (total amount if this is a bill/invoice),
  "date": "YYYY-MM-DD date from the document, or null",
  "expenseCategory": "REPAIRS" | "MAINTENANCE" | "MANAGEMENT_FEE" | "PROPERTY_TAX" | "INSURANCE" | "UTILITIES" | "LANDSCAPING" | "CLEANING" | "PEST_CONTROL" | "LEGAL" | "SUPPLIES" | "OTHER" | null,
  "isExpense": true if this is a bill/invoice/expense document,
  "reference": "invoice/check number if present, or null",
  "confidence": "high" | "medium" | "low"
}`,
            },
          ],
        },
      ],
    });

    // Parse Claude's response
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    let parsed;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    } catch {
      return NextResponse.json({
        error: "Failed to parse AI response",
        raw: text,
      }, { status: 500 });
    }

    // Allow overrides from form
    const overridePropertyId = formData.get("propertyId")?.toString();
    const overrideUnitId = formData.get("unitId")?.toString();

    const finalPropertyId = overridePropertyId || parsed.propertyId;
    const finalUnitId = overrideUnitId || parsed.unitId;

    // Store document in Supabase Storage (or local for now)
    // For now, we'll store the metadata and file reference
    const storagePath = `documents/${Date.now()}-${file.name}`;

    // Create document record
    const doc = await prisma.document.create({
      data: {
        filename: file.name,
        fileUrl: storagePath,
        storagePath,
        type: parsed.documentType || "OTHER",
        linkedEntityType: finalUnitId ? "UNIT" : finalPropertyId ? "PROPERTY" : "PROPERTY",
        linkedEntityId: finalUnitId || finalPropertyId || "",
      },
    });

    // If it's an expense, create expense record too
    let expense = null;
    if (parsed.isExpense && finalPropertyId && parsed.amount) {
      expense = await prisma.expense.create({
        data: {
          propertyId: finalPropertyId,
          unitId: finalUnitId || null,
          category: parsed.expenseCategory || "OTHER",
          vendor: parsed.vendor || null,
          description: parsed.description || file.name,
          amount: parsed.amount,
          date: parsed.date ? new Date(parsed.date) : new Date(),
          reference: parsed.reference || null,
          documentId: doc.id,
          note: `Auto-categorized by AI (confidence: ${parsed.confidence})`,
        },
      });
    }

    return NextResponse.json({
      document: doc,
      expense,
      analysis: parsed,
      message: "Document processed successfully",
    });
  } catch (err) {
    console.error("AI upload error:", err);
    return NextResponse.json({ error: "Failed to process document" }, { status: 500 });
  }
}
