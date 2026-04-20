import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const BUCKET = "documents"; // reuse the existing bucket

/**
 * POST /api/properties/photo
 * Upload a property photo to Supabase Storage and save the path.
 * Body: multipart/form-data with "file" and "propertyId".
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const propertyId = formData.get("propertyId")?.toString();

    if (!file || !propertyId) {
      return NextResponse.json(
        { error: "file and propertyId are required" },
        { status: 400 }
      );
    }

    // Verify property exists
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    // Upload to Supabase Storage
    const supabase = createSupabaseAdminClient();
    const ext = file.name.split(".").pop() || "jpg";
    const safeName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .substring(0, 80);
    const storagePath = `property/${propertyId}/${crypto.randomUUID()}-${safeName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    // Ensure the bucket exists (auto-create if missing)
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((b: any) => b.name === BUCKET);
    if (!bucketExists) {
      console.log(`[property-photo] Creating storage bucket "${BUCKET}"...`);
      const { error: createError } = await supabase.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: 50 * 1024 * 1024, // 50MB
      });
      if (createError && !createError.message?.includes("already exists")) {
        console.error("[property-photo] bucket create error:", createError);
        return NextResponse.json(
          { error: `Storage bucket error: ${createError.message}` },
          { status: 500 }
        );
      }
    }

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[property-photo] upload error:", uploadError);
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Get a long-lived signed URL (1 year)
    const { data: urlData, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year

    if (signError) {
      console.error("[property-photo] sign error:", signError);
    }

    const signedUrl = urlData?.signedUrl ?? "";

    // Store the storage path — used for signing URLs on demand and for deletion
    // Also store the signed URL as a fallback
    await prisma.property.update({
      where: { id: propertyId },
      data: { imageUrl: storagePath },
    });

    return NextResponse.json({ ok: true, imageUrl: signedUrl, storagePath });
  } catch (err) {
    console.error("[property-photo] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/properties/photo?propertyId=xxx
 * Remove the property photo.
 */
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const propertyId = url.searchParams.get("propertyId");

    if (!propertyId) {
      return NextResponse.json({ error: "propertyId required" }, { status: 400 });
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    // Delete from storage if there's an existing image
    if (property.imageUrl) {
      const supabase = createSupabaseAdminClient();
      await supabase.storage.from(BUCKET).remove([property.imageUrl]);
    }

    await prisma.property.update({
      where: { id: propertyId },
      data: { imageUrl: null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[property-photo] delete error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
