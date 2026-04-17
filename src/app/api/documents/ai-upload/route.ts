import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { createSupabaseAdminClient, DOCUMENTS_BUCKET } from "@/lib/supabase/admin";

export const maxDuration = 60;

/**
 * POST /api/documents/ai-upload
 * Two modes:
 *  - action=analyze: Sends file to Claude for analysis, returns suggestions (no save)
 *  - action=save: Stores file in Supabase, creates Document + optional Expense
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const action = formData.get("action")?.toString() || "analyze";
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";
    const isImage = mimeType.startsWith("image/");
    const isPdf = mimeType === "application/pdf";

    if (!isImage && !isPdf) {
      return NextResponse.json({ error: "Please upload a PDF or image file (JPG, PNG, WebP, GIF)" }, { status: 400 });
    }

    // ─── ANALYZE MODE ───
    if (action === "analyze") {
      const base64 = buffer.toString("base64");

      const properties = await prisma.property.findMany({
        include: { units: { select: { id: true, label: true } } },
      });

      const propertyContext = properties.map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        units: p.units.map((u) => ({ id: u.id, label: u.label })),
      }));

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content: any[] = [];
      if (isImage) {
        content.push({ type: "image", source: { type: "base64", media_type: mimeType, data: base64 } });
      } else {
        content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } });
      }
      content.push({ type: "text", text: prompt });

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
          messages: [{ role: "user", content }],
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
      const text = apiResult.content?.[0]?.type === "text" ? apiResult.content[0].text : "";

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

      // Return analysis + property options for the edit form
      return NextResponse.json({
        analysis: parsed,
        properties: propertyContext,
      });
    }

    // ─── SAVE MODE ───
    if (action === "save") {
      const documentType = formData.get("documentType")?.toString() || "OTHER";
      const propertyId = formData.get("propertyId")?.toString() || null;
      const unitId = formData.get("unitId")?.toString() || null;
      const description = formData.get("description")?.toString() || file.name;
      const vendor = formData.get("vendor")?.toString() || null;
      const amount = formData.get("amount") ? parseFloat(formData.get("amount")!.toString()) : null;
      const date = formData.get("date")?.toString() || null;
      const expenseCategory = formData.get("expenseCategory")?.toString() || null;
      const isExpense = formData.get("isExpense")?.toString() === "true";
      const reference = formData.get("reference")?.toString() || null;
      const confidence = formData.get("confidence")?.toString() || "medium";

      const linkedEntityId = unitId || propertyId;
      if (!linkedEntityId) {
        return NextResponse.json({ error: "Please select a property or unit." }, { status: 400 });
      }

      // Upload file to Supabase Storage
      const supabase = createSupabaseAdminClient();
      const entityType = unitId ? "unit" : "property";
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
      const storagePath = `${entityType}/${linkedEntityId}/${randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        return NextResponse.json(
          { error: `File upload failed: ${uploadError.message}` },
          { status: 500 }
        );
      }

      // Create document record
      const doc = await prisma.document.create({
        data: {
          filename: file.name,
          fileUrl: "",
          storagePath,
          type: documentType as any,
          linkedEntityType: unitId ? "UNIT" : "PROPERTY",
          linkedEntityId,
        },
      });

      // Create expense record if applicable
      let expense = null;
      if (isExpense && propertyId && amount) {
        expense = await prisma.expense.create({
          data: {
            propertyId,
            unitId: unitId || null,
            category: (expenseCategory || "OTHER") as any,
            vendor,
            description,
            amount,
            date: date ? new Date(date) : new Date(),
            reference,
            documentId: doc.id,
            note: `Auto-categorized by AI (confidence: ${confidence})`,
          },
        });
      }

      return NextResponse.json({
        document: doc,
        expense,
        message: "Document saved successfully",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("AI upload error:", err);
    const message = err instanceof Error ? err.message : "Failed to process document";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
