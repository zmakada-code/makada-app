"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ExternalLink, Upload, X, Loader2 } from "lucide-react";

type Props = {
  unitId: string;
  propertyName: string;
  unitLabel: string;
  currentDescription: string;
  currentZillowUrl: string;
  currentPhotoPaths: string[];
  isPublished: boolean;
};

export function ListingEditor({
  unitId,
  propertyName,
  unitLabel,
  currentDescription,
  currentZillowUrl,
  currentPhotoPaths,
  isPublished,
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [description, setDescription] = useState(currentDescription);
  const [zillowUrl, setZillowUrl] = useState(currentZillowUrl);
  const [photoPaths, setPhotoPaths] = useState<string[]>(currentPhotoPaths);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Load signed URLs for existing photos on mount
  useState(() => {
    if (photoPaths.length > 0) {
      fetch(`/api/zillow-rentals/${unitId}/photos`)
        .then((r) => r.json())
        .then((data) => setPhotoUrls(data.urls ?? []))
        .catch(() => {});
    }
  });

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/zillow-rentals/${unitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, zillowUrl }),
      });
      if (!res.ok) throw new Error("Save failed");
      setMessage({ text: "Changes saved.", type: "success" });
      router.refresh();
    } catch {
      setMessage({ text: "Failed to save changes.", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/zillow-rentals/${unitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, zillowUrl, isPublished: true }),
      });
      if (!res.ok) throw new Error("Publish failed");
      setMessage({ text: "Unit is now live on the properties website!", type: "success" });
      router.refresh();
    } catch {
      setMessage({ text: "Failed to publish.", type: "error" });
    } finally {
      setPublishing(false);
    }
  }

  async function handleUnpublish() {
    setUnpublishing(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/zillow-rentals/${unitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: false }),
      });
      if (!res.ok) throw new Error("Unpublish failed");
      setMessage({ text: "Unit removed from properties website.", type: "success" });
      router.refresh();
    } catch {
      setMessage({ text: "Failed to unpublish.", type: "error" });
    } finally {
      setUnpublishing(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("photos", files[i]);
    }

    try {
      const res = await fetch(`/api/zillow-rentals/${unitId}/photos`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setPhotoPaths(data.paths);
      setPhotoUrls(data.urls);
      setMessage({ text: `${files.length} photo(s) uploaded.`, type: "success" });
      router.refresh();
    } catch {
      setMessage({ text: "Failed to upload photos.", type: "error" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDeletePhoto(index: number) {
    setMessage(null);
    try {
      const res = await fetch(`/api/zillow-rentals/${unitId}/photos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index }),
      });
      if (!res.ok) throw new Error("Delete failed");
      const data = await res.json();
      setPhotoPaths(data.paths);
      setPhotoUrls(data.urls);
      router.refresh();
    } catch {
      setMessage({ text: "Failed to delete photo.", type: "error" });
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Status banner */}
      <div
        className={`rounded-lg border px-4 py-3 flex items-center justify-between ${
          isPublished
            ? "bg-emerald-50 border-emerald-200"
            : "bg-slate-50 border-slate-200"
        }`}
      >
        <div className="flex items-center gap-2 text-sm">
          {isPublished ? (
            <>
              <Eye className="h-4 w-4 text-emerald-600" />
              <span className="font-medium text-emerald-800">
                This unit is live on the properties website
              </span>
            </>
          ) : (
            <>
              <EyeOff className="h-4 w-4 text-slate-500" />
              <span className="font-medium text-slate-700">
                This unit is a draft — not visible on the properties website
              </span>
            </>
          )}
        </div>
      </div>

      {/* Photos */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Listing Photos</h2>

        {photoUrls.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            {photoUrls.map((url, i) => (
              <div key={i} className="relative group rounded-lg overflow-hidden border border-slate-200">
                <img src={url} alt={`Photo ${i + 1}`} className="h-36 w-full object-cover" />
                <button
                  onClick={() => handleDeletePhoto(i)}
                  className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove photo"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoUpload}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? "Uploading..." : "Upload photos"}
          </button>
          <span className="text-xs text-slate-500">{photoPaths.length} photo(s) uploaded</span>
        </div>
      </div>

      {/* Description */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Public Description</h2>
        <p className="text-xs text-slate-500 mb-3">
          This appears on the properties website. Describe the unit, features, and neighborhood.
        </p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          placeholder="Spacious 2-bedroom apartment with natural light, updated kitchen, in-unit laundry..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        />
      </div>

      {/* Zillow URL */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Zillow Listing Link</h2>
        <p className="text-xs text-slate-500 mb-3">
          Paste the Zillow rental URL so prospects can apply directly through Zillow.
        </p>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="url"
              value={zillowUrl}
              onChange={(e) => setZillowUrl(e.target.value)}
              placeholder="https://www.zillow.com/rental/..."
              className="w-full rounded-lg border border-slate-200 pl-10 pr-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          {zillowUrl && (
            <a
              href={zillowUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              Preview <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pb-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition"
        >
          {saving ? "Saving..." : "Save draft"}
        </button>

        {isPublished ? (
          <button
            onClick={handleUnpublish}
            disabled={unpublishing}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition"
          >
            <EyeOff className="h-4 w-4" />
            {unpublishing ? "Removing..." : "Remove from website"}
          </button>
        ) : (
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition"
          >
            <Eye className="h-4 w-4" />
            {publishing ? "Publishing..." : "Publish to properties website"}
          </button>
        )}
      </div>
    </div>
  );
}
