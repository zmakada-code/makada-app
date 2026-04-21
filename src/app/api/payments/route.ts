import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createReceiptDocument } from "@/lib/create-receipt-document";
import { createSupabaseAdminClient, DOCUMENTS_BUCKET } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";
import type { PaymentMethod } from "@prisma/client";

/**
 * POST /api/payments
 * Log a manual payment (check, cash, etc.) from the admin app.
 * Accepts FormData with optional photo, or JSON body.
 * Auto-generates a receipt document in Supabase Storage.
 */
export async function POST(req: NextRequest) {
  try {
    let leaseId: string | null = null;
    let period: string | null = null;
    let method: string | null = null;
    let amountPaid: number | null = null;
    let note: string | null = null;
    let photoFile: File | null = null;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const fd = await req.formData();
      leaseId = fd.get("leaseId")?.toString() || null;
      period = fd.get("period")?.toString() || null;
      method = fd.get("method")?.toString() || null;
      const amt = fd.get("amountPaid")?.toString();
      amountPaid = amt ? Number(amt) : null;
      note = fd.get("note")?.toString() || null;
      const photo = fd.get("photo");
      if (photo && photo instanceof File && photo.size > 0) {
        photoFile = photo;
      }
    } else {
      const body = await req.json();
      leaseId = body.leaseId;
      period = body.period;
      method = body.method;
      amountPaid = body.amountPaid ?? null;
      note = body.note ?? null;
    }

    if (!leaseId || !period || !method) {
      return NextResponse.json(
        { error: "leaseId, period, and method are required" },
        { status: 400 }
      );
    }

    const validMethods = ["CHECK", "CASH", "TURBOTENANT", "ONLINE", "OTHER"];
    if (!validMethods.includes(method)) {
      return NextResponse.json(
        { error: `Invalid method. Must be one of: ${validMethods.join(", ")}` },
        { status: 400 }
      );
    }

    // Upload photo if provided
    let photoStoragePath: string | null = null;
    if (photoFile) {
      const supabase = createSupabaseAdminClient();
      const ext = photoFile.name.split(".").pop() || "jpg";
      const filename = `payment-proof-${period}-${randomUUID()}.${ext}`;
      photoStoragePath = `payment-proofs/${leaseId}/${filename}`;

      const buffer = Buffer.from(await photoFile.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(photoStoragePath, buffer, {
          contentType: photoFile.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("Payment photo upload error:", uploadError);
        // Continue without photo — don't block the payment
        photoStoragePath = null;
      }
    }

    // Build the note with photo reference
    const fullNote = [note, photoStoragePath ? `[Photo: ${photoStoragePath}]` : null]
      .filter(Boolean)
      .join(" · ") || null;

    const typedMethod = method as PaymentMethod;

    const payment = await prisma.paymentStatus.upsert({
      where: { leaseId_period: { leaseId, period } },
      update: {
        status: "PAID",
        method: typedMethod,
        amountPaid: amountPaid ?? null,
        paidAt: new Date(),
        note: fullNote,
      },
      create: {
        leaseId,
        period,
        status: "PAID",
        method: typedMethod,
        amountPaid: amountPaid ?? null,
        paidAt: new Date(),
        note: fullNote,
      },
    });

    // If a photo was uploaded, also create a Document record for it
    if (photoStoragePath) {
      const lease = await prisma.lease.findUnique({
        where: { id: leaseId },
        select: { unitId: true },
      });
      if (lease) {
        await prisma.document.create({
          data: {
            filename: `payment-proof-${period}.${photoFile!.name.split(".").pop() || "jpg"}`,
            fileUrl: "",
            storagePath: photoStoragePath,
            type: "RECEIPT",
            linkedEntityType: "UNIT",
            linkedEntityId: lease.unitId,
          },
        });
      }
    }

    // Auto-generate receipt document
    await createReceiptDocument(payment.id);

    return NextResponse.json({ payment });
  } catch (err) {
    console.error("Manual payment logging error:", err);
    return NextResponse.json({ error: "Failed to log payment" }, { status: 500 });
  }
}
