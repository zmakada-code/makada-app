"use client";

import { useState, useRef } from "react";
import { Camera, X, Upload, Loader2 } from "lucide-react";

export function PropertyPhotoUpload({
  propertyId,
  currentImageUrl,
}: {
  propertyId: string;
  currentImageUrl: string | null;
}) {
  const [imageUrl, setImageUrl] = useState(currentImageUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("propertyId", propertyId);

      const res = await fetch("/api/properties/photo", {
        method: "POST",
        body: fd,
      });

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error(`Server returned ${res.status} — check Supabase config`);
      }
      if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);

      // Use the signed URL from the response, or fall back to storagePath
      setImageUrl(data.imageUrl || data.storagePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemove() {
    setUploading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/properties/photo?propertyId=${propertyId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to remove");
      setImageUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700">
        Property photo
      </label>

      {imageUrl ? (
        <div className="relative group w-full max-w-md">
          <img
            src={imageUrl}
            alt="Property"
            className="w-full h-48 object-cover rounded-lg border border-slate-200"
          />
          <button
            type="button"
            onClick={handleRemove}
            disabled={uploading}
            className="absolute top-2 right-2 bg-white/90 hover:bg-white text-slate-600 hover:text-red-600 rounded-full p-1.5 shadow-sm transition opacity-0 group-hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex flex-col items-center justify-center w-full max-w-md h-48 rounded-lg border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 transition text-slate-500 hover:text-indigo-600"
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : (
            <>
              <Camera className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">Upload property photo</span>
              <span className="text-xs text-slate-400 mt-1">
                JPG, PNG, or WebP
              </span>
            </>
          )}
        </button>
      )}

      {imageUrl && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          <Upload className="h-3.5 w-3.5" />
          Replace photo
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
