import { colors, fontMono } from "../lib/theme";
import type { DrawingAnalysis } from "../lib/types";

export function RequirementsPanel({ poRequirements, drawing }: { poRequirements: string[]; drawing: DrawingAnalysis | null | undefined }) {
  if (poRequirements.length === 0 && !drawing) return null;
  return (
    <div style={{ padding: "6px 20px 16px" }}>
      {poRequirements.length > 0 ? (
        <div style={{ marginBottom: drawing ? 14 : 0 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: colors.textFaint, fontWeight: 600, marginBottom: 4 }}>
            From the Purchase Order
          </div>
          {poRequirements.map((r, i) => (
            <div key={i} style={{ fontSize: 12, marginTop: 3 }}>☐ {r}</div>
          ))}
        </div>
      ) : null}
      {drawing ? (
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: colors.textFaint, fontWeight: 600, marginBottom: 4 }}>
            From Drawing Scan — {drawing.filename}
          </div>
          {(drawing.processing_requirements ?? []).map((p, i) => (
            <div key={`proc-${i}`} style={{ fontSize: 12, marginTop: 3 }}>
              <span style={{ fontWeight: 600 }}>{p.process}</span>
              {p.spec ? <span style={{ fontFamily: fontMono, color: colors.accentDefault }}> · {p.spec}</span> : null}
              {p.class_type ? ` — ${p.class_type}` : ""}
            </div>
          ))}
          {(drawing.masking_requirements ?? []).length > 0 ? (
            <div style={{ fontSize: 12, marginTop: 6 }}>
              <span style={{ fontWeight: 600 }}>Masking: </span>
              {(drawing.masking_requirements ?? []).join("; ")}
            </div>
          ) : null}
          {(drawing.post_treatment_requirements ?? []).map((p, i) => (
            <div key={`post-${i}`} style={{ fontSize: 12, marginTop: 3 }}>
              <span style={{ fontWeight: 600 }}>{p.treatment}</span>
              {p.spec ? <span style={{ fontFamily: fontMono, color: colors.accentDefault }}> · {p.spec}</span> : null}
              {p.notes ? ` — ${p.notes}` : ""}
            </div>
          ))}
          {(drawing.governing_specs ?? []).length > 0 ? (
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(drawing.governing_specs ?? []).map((s, i) => (
                <span key={i} title={s.description} style={{ fontFamily: fontMono, fontSize: 11, border: `1px solid ${colors.cardBorder}`, borderRadius: 4, padding: "3px 8px", background: "#FAFBFB" }}>
                  {s.spec}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
