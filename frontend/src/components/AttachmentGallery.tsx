import { useEffect, useRef, useState } from "react";
import { colors } from "../lib/theme";
import { getAttachmentFileBlob } from "../api/endpoints";
import { useAttachments, useDeleteAttachment, useUploadAttachment } from "../lib/queries";
import type { Attachment } from "../lib/types";

/** `<img>`/`<video src>` can't send an Authorization header, and these files are
 * behind auth (some ITAR-controlled) — so each item fetches its bytes through the
 * authenticated API client and renders from a local blob: object URL instead of
 * hitting the file endpoint directly. */
function AttachmentMedia({ attachment }: { attachment: Attachment }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    getAttachmentFileBlob(attachment.id).then((blob) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id]);

  if (!url) {
    return <div style={{ width: "100%", height: 100, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: colors.textFaint }}>Loading…</div>;
  }
  return attachment.kind === "image" ? (
    <img src={url} alt={attachment.label || attachment.filename} style={{ width: "100%", height: 100, objectFit: "cover", display: "block" }} />
  ) : (
    <video src={url} controls style={{ width: "100%", height: 100, objectFit: "cover", display: "block", background: "#000000" }} />
  );
}

/** Reference photos/videos for a Part (what it looks like) or a RoutingStep (process
 * instruction / quality alert) — used both by planners authoring the plan (editable)
 * and by operators on the shop floor (readOnly). */
export function AttachmentGallery({
  entityType,
  entityId,
  readOnly = false,
  emptyText = "No photos or videos yet.",
}: {
  entityType: "part" | "routing_step";
  entityId: number | string | undefined;
  readOnly?: boolean;
  emptyText?: string;
}) {
  const { data: attachments } = useAttachments(entityType, entityId);
  const upload = useUploadAttachment();
  const del = useDeleteAttachment();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [isQualityAlert, setIsQualityAlert] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || entityId === undefined) return;
    setError(null);
    try {
      await upload.mutateAsync({ entityType, entityId, file, label, isQualityAlert });
      setLabel("");
      setIsQualityAlert(false);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Upload failed.");
    }
  }

  const items = attachments ?? [];

  return (
    <div>
      {error ? <div style={{ fontSize: 11, color: colors.red, marginBottom: 8 }}>{error}</div> : null}
      {items.length === 0 ? (
        <div style={{ fontSize: 11, color: colors.textFaint, marginBottom: readOnly ? 0 : 8 }}>{emptyText}</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: readOnly ? 0 : 10 }}>
          {items.map((a) => (
            <div
              key={a.id}
              style={{
                border: `1px solid ${a.is_quality_alert ? colors.red : colors.cardBorder}`,
                borderRadius: 6,
                overflow: "hidden",
                background: "#FAFBFB",
                position: "relative",
              }}
            >
              {a.is_quality_alert ? (
                <div
                  style={{
                    position: "absolute", top: 4, left: 4, zIndex: 1, background: colors.red, color: "#FFFFFF",
                    fontSize: 9, fontWeight: 700, letterSpacing: "0.03em", padding: "2px 5px", borderRadius: 3,
                  }}
                >
                  ⚠ QUALITY ALERT
                </div>
              ) : null}
              {!readOnly ? (
                <button
                  onClick={() => del.mutate({ id: a.id, entityType, entityId: entityId as number | string })}
                  title="Remove"
                  style={{
                    position: "absolute", top: 4, right: 4, zIndex: 1, background: "rgba(20,26,30,0.6)", color: "#FFFFFF",
                    border: "none", borderRadius: 4, width: 20, height: 20, fontSize: 11, cursor: "pointer", lineHeight: "20px",
                  }}
                >
                  ✕
                </button>
              ) : null}
              <AttachmentMedia attachment={a} />
              {a.label ? (
                <div style={{ fontSize: 10, padding: "4px 6px", color: colors.textMuted, borderTop: `1px solid ${colors.rowBorder}` }}>{a.label}</div>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {!readOnly && entityId !== undefined ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Caption (optional)"
            style={{ maxWidth: 200, border: `1px solid ${colors.cardBorder}`, borderRadius: 5, padding: "6px 8px", fontSize: 11 }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: colors.textMuted }}>
            <input type="checkbox" checked={isQualityAlert} onChange={(e) => setIsQualityAlert(e.target.checked)} />
            Quality alert
          </label>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={upload.isPending}
            style={{ background: "#FFFFFF", color: colors.text, border: `1px solid ${colors.cardBorder}`, borderRadius: 5, padding: "6px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
          >
            {upload.isPending ? "Uploading…" : "+ Add Photo/Video"}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileChosen} style={{ display: "none" }} />
        </div>
      ) : null}
    </div>
  );
}
