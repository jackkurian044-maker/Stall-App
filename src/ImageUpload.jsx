import React, { useRef, useState } from "react";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { storage } from "./firebase";
import { COLORS } from "./constants";

const MAX_PHOTOS = 4;

/**
 * Simple multi-photo uploader backed by Firebase Storage.
 * `photos` is an array of download URLs; `pathPrefix` scopes where files
 * land in Storage (e.g. `vendor-photos/<some-id>`).
 */
export default function ImageUpload({ photos = [], pathPrefix, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const handleFiles = async (files) => {
    setError("");
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      setError(`Up to ${MAX_PHOTOS} photos per listing.`);
      return;
    }
    const toUpload = Array.from(files).slice(0, remaining);
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of toUpload) {
        if (!file.type.startsWith("image/")) continue;
        if (file.size > 5 * 1024 * 1024) {
          setError("Each photo must be under 5MB — skipped one that was too large.");
          continue;
        }
        const path = `${pathPrefix}/${Date.now()}-${file.name}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        uploaded.push({ url, path });
      }
      onChange([...photos, ...uploaded.map((u) => u.url)]);
    } catch (err) {
      setError("Upload failed — try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePhoto = async (url) => {
    onChange(photos.filter((p) => p !== url));
    // Best-effort cleanup — if this fails (e.g. URL format changed),
    // it's not worth blocking the person over an orphaned file.
    try {
      const storageRef = ref(storage, url);
      await deleteObject(storageRef);
    } catch {
      // ignore
    }
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>
        Photos ({photos.length}/{MAX_PHOTOS})
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        {photos.map((url) => (
          <div key={url} style={{ position: "relative", width: 72, height: 72, borderRadius: 8, overflow: "hidden", border: `1.5px solid ${COLORS.ink}` }}>
            <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <button
              type="button"
              onClick={() => removePhoto(url)}
              style={{
                position: "absolute", top: 2, right: 2, background: "rgba(24,38,32,0.85)", border: "none",
                borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", padding: 0,
              }}
              title="Remove photo"
            >
              <X size={11} color="#fff" />
            </button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              width: 72, height: 72, borderRadius: 8, border: `1.5px dashed ${COLORS.ink}77`,
              background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 4, cursor: "pointer", color: "#777",
            }}
          >
            {uploading ? <Loader2 size={16} className="spin" /> : <ImagePlus size={16} />}
            <span style={{ fontSize: 9 }}>{uploading ? "Uploading" : "Add"}</span>
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
        style={{ display: "none" }}
      />
      {error && <div style={{ fontSize: 11, color: COLORS.brick }}>{error}</div>}
    </div>
  );
}
