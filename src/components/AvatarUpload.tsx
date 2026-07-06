"use client";

import { useState, useRef } from "react";

type AvatarUploadProps = {
  currentAvatarUrl?: string | null;
  userName?: string;
  userId?: string; // Only needed for admin uploading on behalf of a client
  size?: "sm" | "md" | "lg"; // sm=40px, md=64px, lg=96px
  onUploadComplete?: (newUrl: string) => void;
  onRemove?: () => void;
};

// Resize image client-side using canvas (target: 200x200px, JPEG quality 0.85)
async function resizeImage(file: File, maxSize = 200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));

      // Crop to square (center crop)
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;

      canvas.width = maxSize;
      canvas.height = maxSize;
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, maxSize, maxSize);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to create blob"));
        },
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

export default function AvatarUpload({
  currentAvatarUrl,
  userName,
  userId,
  size = "lg",
  onUploadComplete,
  onRemove,
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayUrl = previewUrl || currentAvatarUrl;
  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const sizeClasses = {
    sm: "w-10 h-10",
    md: "w-16 h-16",
    lg: "w-24 h-24",
  };

  const sizePixels = { sm: 40, md: 64, lg: 96 };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");

    // Validate type
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Use JPEG, PNG, or WebP images only.");
      return;
    }

    // Validate size (raw file can be up to 10MB, we'll resize it)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image too large. Max 10MB.");
      return;
    }

    setUploading(true);

    try {
      // Resize client-side
      const resized = await resizeImage(file);

      // Show preview immediately
      const preview = URL.createObjectURL(resized);
      setPreviewUrl(preview);

      // Upload
      const formData = new FormData();
      formData.append("file", resized, `avatar.jpg`);
      if (userId) formData.append("userId", userId);

      const res = await fetch("/api/upload-avatar", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      onUploadComplete?.(data.avatarUrl);
    } catch (err: any) {
      setError(err.message || "Upload failed. Please try again.");
      setPreviewUrl(null);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!confirm("Remove your profile photo?")) return;
    setUploading(true);
    setError("");

    try {
      const url = userId
        ? `/api/upload-avatar?userId=${userId}`
        : "/api/upload-avatar";
      const res = await fetch(url, { method: "DELETE" });

      if (!res.ok) {
        throw new Error("Failed to remove photo");
      }

      setPreviewUrl(null);
      onRemove?.();
    } catch (err: any) {
      setError(err.message || "Failed to remove photo.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar circle */}
      <div className="relative group">
        <div
          className={`${sizeClasses[size]} rounded-full overflow-hidden bg-secondary border-2 border-white/10 flex items-center justify-center relative`}
        >
          {displayUrl ? (
            <img
              src={displayUrl}
              alt={userName || "Profile photo"}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span
              className="text-accent font-bold"
              style={{ fontSize: sizePixels[size] * 0.3 }}
            >
              {initials}
            </span>
          )}

          {/* Overlay on hover */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer rounded-full"
          >
            {uploading ? (
              <svg
                className="w-5 h-5 text-white animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Remove button (shown when there's a photo) */}
        {displayUrl && !uploading && (
          <button
            onClick={handleRemove}
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
            title="Remove photo"
          >
            <svg
              className="w-3 h-3 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Upload text hint */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="text-accent text-xs hover:underline disabled:opacity-50"
      >
        {uploading ? "Uploading..." : displayUrl ? "Change photo" : "Add photo"}
      </button>

      {/* Error */}
      {error && <p className="text-red-400 text-xs text-center">{error}</p>}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
