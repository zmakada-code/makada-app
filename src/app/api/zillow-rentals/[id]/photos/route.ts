import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSignedDocumentUrl } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const BUCKET = "documents";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getSignedUrls(paths: string[]): Promise<string[]> {
  const urls = await Promise.all(
    paths.map((p) => getSignedDocumentUrl(p, 60 * 60 * 24))
  );
  return urls.filter(Boolean) as string[];
}

/**
 * GET /api/zillow-rentals/[id]/photos
 * Returns signed URLs for all listing photos
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const unit = await prisma.unit.findUnique({
    where: { id: params.id },
    select: { listingPhotos: true },
  });

  if (!unit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let paths: string[] = [];
  if (unit.listingPhotos) {
    try { paths = JSON.parse(unit.listingPhotos); } catch {}
  }

  const urls = await getSignedUrls(paths);
  return NextResponse.json({ paths, urls });
}

/**
 * POST /api/zillow-rentals/[id]/photos
 * Upload one or more listing photos
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("photos") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const unit = await prisma.unit.findUnique({
      where: { id: params.id },
      select: { listingPhotos: true },
    });

    if (!unit) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let existingPaths: string[] = [];
    if (unit.listingPhotos) {
      try { existingPaths = JSON.parse(unit.listingPhotos); } catch {}
    }

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.some((b) => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: false });
    }

    const newPaths: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `listing-photos/${params.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (error) {
        console.error("[photo-upload] Error:", error.message);
        continue;
      }

      newPaths.push(path);
    }

    const allPaths = [...existingPaths, ...newPaths];

    await prisma.unit.update({
      where: { id: params.id },
      data: { listingPhotos: JSON.stringify(allPaths) },
    });

    const urls = await getSignedUrls(allPaths);

    revalidatePath(`/zillow-rentals/${params.id}`);
    return NextResponse.json({ paths: allPaths, urls });
  } catch (err) {
    console.error("[photo-upload] Error:", err);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/zillow-rentals/[id]/photos
 * Remove a photo by index
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { index } = await request.json();

    const unit = await prisma.unit.findUnique({
      where: { id: params.id },
      select: { listingPhotos: true },
    });

    if (!unit) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let paths: string[] = [];
    if (unit.listingPhotos) {
      try { paths = JSON.parse(unit.listingPhotos); } catch {}
    }

    if (index < 0 || index >= paths.length) {
      return NextResponse.json({ error: "Invalid index" }, { status: 400 });
    }

    // Delete from storage
    const supabase = getAdminClient();
    await supabase.storage.from(BUCKET).remove([paths[index]]);

    // Remove from array
    paths.splice(index, 1);

    await prisma.unit.update({
      where: { id: params.id },
      data: { listingPhotos: JSON.stringify(paths) },
    });

    const urls = await getSignedUrls(paths);

    revalidatePath(`/zillow-rentals/${params.id}`);
    return NextResponse.json({ paths, urls });
  } catch (err) {
    console.error("[photo-delete] Error:", err);
    return NextResponse.json(
      { error: "Delete failed" },
      { status: 500 }
    );
  }
}
