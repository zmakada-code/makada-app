import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Allow larger uploads (up to 10MB)
export const maxDuration = 60;

/**
 * POST /api/documents/ai-upload
 * Accepts a PDF or image upload, uses Claude to analyze it, and auto-categorizes it
 * to the correct property/unit. Also extracts expense data if applicable.
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
    const mimeType = file.type || "application/octet-stream";
    const isImage = mimeType.startsWith("image/");
    const isPdf = mimeType === "application/pdf";

    if (!isImage && !isPdf) {
      return NextResponse.json({ error: "Please upload a PDF or image file (JPG, PNG, WebP, GIF)" }, { status: 400 });
    }

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

    const prompt = `Analyze this document and extract the following information. Return ONLY valid JSON, no other text.

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
}`;

    // Build the content array for the API call
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = [];

    if (isImage) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mimeType,
          data: base64,
        },
      });
    } else {
      // PDF — send as document type
      content.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: base64,
        },
      });
    }

    content.push({ type: "text", text: prompt });

    // Call Anthropic API directly via fetch for maximum compatibility
    const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content,
          },
        ],
      }),
    });

    if (!apiResponse.ok) {
      const errBody = await apiResponse.text();
      console.error("Anthropic API error:", apiResponse.status, errBody);
      return NextResponse.json(
        { error: `AI analysis failed (${apiResponse.status}). Please try a smaller file or a different format.` },
        { status: 500 }
      );
    }

    const apiResult = await apiResponse.json();

    // Parse Claude's response
    const text =
      apiResult.content?.[0]?.type === "text" ? apiResult.content[0].text : "";
    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "AI could not analyze this document. Try a clearer image or PDF.", raw: text },
        { status: 500 }
      );
    }

    // Allow overrides from form
    const overridePropertyId = formData.get("propertyId")?.toString();
    const overrideUnitId = formData.get("unitId")?.toString();

    const finalPropertyId = overridePropertyId || parsed.propertyId;
    const finalUnitId = overrideUnitId || parsed.unitId;

    // We need at least a property to link to
    const linkedEntityId = finalUnitId || finalPropertyId;
    if (!linkedEntityId) {
      return NextResponse.json(
        {
          error: "AI could not match this document to a property. Please try again or file it manually.",
          analysis: parsed,
        },
        { status: 400 }
      );
    }

    const storagePath = `documents/${Date.now()}-${file.name}`;

    // Create document record
    const doc = await prisma.document.create({
      data: {
        filename: file.name,
        fileUrl: storagePath,
        storagePath,
        type: parsed.documentType || "OTHER",
        linkedEntityType: finalUnitId ? "UNIT" : "PROPERTY",
        linkedEntityId,
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
    const message = err instanceof Error ? err.message : "Failed to process document";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
