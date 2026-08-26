import { useRef, useState } from "react";
import { colors, fontMono } from "../lib/theme";
import { fmtDateTime } from "../lib/format";
import { useAnalyzeDrawingsBatch, useDrawingAiStatus, useDrawingAnalyses } from "../lib/queries";
import * as api from "../api/endpoints";
import type { DrawingAnalysis, DrawingBatchResult } from "../lib/types";
import { Card } from "./Table";
import { Chip } from "./Chip";

const confKind = (c: string | null) => (c === "high" ? "good" : c === "medium" ? "warn" : c === "low" ? "bad" : "neutral");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: `1px solid ${colors.rowBorder}` }}>
      <div style={{ padding: "12px 20px 6px", fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", color: colors.textFaint, fontWeight: 700 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function HeaderRow({ cols }: { cols: string[] }) {
  return (
    <tr>
      {cols.map((h, i) => (
        <th key={h} style={{ textAlign: "left", padding: i === 0 ? "7px 20px" : "7px 8px", fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: colors.textFaint, fontWeight: 600 }}>
          {h}
        </th>
      ))}
    </tr>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ padding: "8px 20px 14px", fontSize: 12, color: colors.textMuted }}>{text}</div>;
}

/** Scan-a-drawing panel (upload + past scans + detail view) shared by Quoting (reference
 * info while pricing) and — via the underlying service, not this component — the Sales
 * Order PO-scan flow, which already scans any drawings attached to a PO the same way. */
export function DrawingScanPanel() {
  const { data: ai } = useDrawingAiStatus();
  const { data: analyses } = useDrawingAnalyses();
  const analyze = useAnalyzeDrawingsBatch();
  const fileInput = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [batchResults, setBatchResults] = useState<DrawingBatchResult[] | null>(null);

  const selected: DrawingAnalysis | undefined =
    (analyses ?? []).find((a) => a.id === selectedId) ?? (analyses ?? [])[0];

  function submit(files: FileList | File[] | undefined | null) {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    setError(null);
    setBatchResults(null);
    analyze.mutate(list, {
      onSuccess: (results) => {
        setBatchResults(results);
        const lastSuccess = [...results].reverse().find((r) => r.success && r.analysis);
        if (lastSuccess?.analysis) setSelectedId(lastSuccess.analysis.id);
      },
      onError: (err: unknown) => {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(detail ?? "Analysis failed");
      },
    });
  }

  return (
    <section style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16, alignItems: "start" }}>
      <div style={{ display: "grid", gap: 16 }}>
        <Card>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${colors.rowBorder}`, fontSize: 13, fontWeight: 700 }}>
            Scan a Drawing
          </div>
          <div style={{ padding: 14 }}>
            {ai && !ai.configured ? (
              <div style={{ background: "#FFF8EC", border: "1px solid #E3C888", borderRadius: 6, padding: "8px 12px", fontSize: 11, color: "#8A6D1D", marginBottom: 12 }}>
                ⚠ {ai.detail}
              </div>
            ) : null}
            <div
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); submit(e.dataTransfer.files); }}
              style={{
                border: `2px dashed ${dragOver ? colors.accentDefault : colors.cardBorder}`,
                background: dragOver ? "#F0F5F8" : "#FAFBFB",
                borderRadius: 8, padding: "28px 16px", textAlign: "center", cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 26 }}>⎙</div>
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6 }}>
                {analyze.isPending ? "Analyzing drawings…" : "Drop one or more PDF drawings here or click to browse"}
              </div>
              <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
                Claude reads each print and extracts finish callouts, governing specs, masking, and estimated surface area —
                useful reference while pricing a quote. Select or drop several at once to batch-scan a whole RFQ packet.
              </div>
              {analyze.isPending ? (
                <div style={{ marginTop: 10, fontSize: 11, color: colors.accentDefault, fontFamily: fontMono }}>
                  vision + reasoning pass, one file at a time… this can take a minute per dense print
                </div>
              ) : null}
            </div>
            <input
              ref={fileInput} type="file" accept="application/pdf" multiple style={{ display: "none" }}
              onChange={(e) => { submit(e.target.files); e.target.value = ""; }}
            />
            {error ? (
              <div style={{ marginTop: 10, background: "#FBEFEF", border: `1px solid ${colors.red}`, borderRadius: 6, padding: "8px 12px", fontSize: 11, color: colors.red }}>
                {error}
              </div>
            ) : null}
            {batchResults && batchResults.length > 0 ? (
              <div style={{ marginTop: 10, border: `1px solid ${colors.cardBorder}`, borderRadius: 6, overflow: "hidden" }}>
                {batchResults.map((r, i) => (
                  <div
                    key={i}
                    onClick={() => r.success && r.analysis && setSelectedId(r.analysis.id)}
                    style={{
                      padding: "7px 10px", fontSize: 11, borderTop: i === 0 ? "none" : `1px solid ${colors.rowBorder}`,
                      cursor: r.success ? "pointer" : "default", display: "flex", alignItems: "center", gap: 8,
                    }}
                  >
                    <span style={{ color: r.success ? colors.green : colors.red, fontWeight: 700 }}>{r.success ? "✓" : "✗"}</span>
                    <span style={{ fontFamily: fontMono, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.filename}</span>
                    {!r.success ? <span style={{ color: colors.textMuted }}>{r.error}</span> : null}
                  </div>
                ))}
                <div style={{ padding: "6px 10px", fontSize: 10, color: colors.textFaint, borderTop: `1px solid ${colors.rowBorder}`, background: "#FAFBFB" }}>
                  {batchResults.filter((r) => r.success).length} of {batchResults.length} scanned successfully
                </div>
              </div>
            ) : null}
            <div style={{ marginTop: 10, fontSize: 10, color: colors.textFaint }}>
              Model: <span style={{ fontFamily: fontMono }}>{ai?.model ?? "—"}</span> · results are advisory —
              a quoting engineer reviews before use.
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${colors.rowBorder}`, fontSize: 13, fontWeight: 700 }}>
            Past Scans
          </div>
          {(analyses ?? []).length === 0 ? (
            <div style={{ padding: 14, fontSize: 12, color: colors.textMuted }}>No drawings scanned yet.</div>
          ) : (
            (analyses ?? []).map((a) => {
              const active = selected?.id === a.id;
              return (
                <div
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className="row-hover"
                  style={{
                    padding: "10px 14px", borderTop: `1px solid ${colors.rowBorder}`, cursor: "pointer",
                    background: active ? "#F0F5F8" : "transparent",
                    borderLeft: `3px solid ${active ? colors.accentDefault : "transparent"}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: fontMono, fontSize: 12, fontWeight: 600, color: colors.accentDefault }}>
                      {a.part_number ?? a.filename}
                    </span>
                    <Chip kind={a.status === "Complete" ? "good" : "bad"} text={a.status} />
                  </div>
                  <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}>
                    {a.filename} · {a.created_by} · {fmtDateTime(a.created_at)}
                  </div>
                </div>
              );
            })
          )}
        </Card>
      </div>

      <Card>
        {!selected ? (
          <div style={{ padding: 24, fontSize: 12, color: colors.textMuted }}>
            Scan a drawing to see extracted processing requirements and surface area here.
          </div>
        ) : selected.status !== "Complete" ? (
          <div style={{ padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.red }}>Analysis failed</div>
            <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 8, fontFamily: fontMono }}>{selected.error_detail}</div>
          </div>
        ) : (
          <>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${colors.rowBorder}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: fontMono, fontSize: 17, fontWeight: 700 }}>
                  {selected.part_number ?? "(no part number found)"}
                </span>
                {selected.revision ? <Chip kind="info" text={`Rev ${selected.revision}`} /> : null}
                <Chip kind={confKind(selected.surface_area_confidence)} text={`area confidence: ${selected.surface_area_confidence ?? "—"}`} />
                {selected.stored_file_path ? (
                  <a
                    href={api.drawingFileUrl(selected.id)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: colors.accentDefault }}
                  >
                    View original PDF ↗
                  </a>
                ) : null}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 14 }}>
                <div>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: colors.textFaint, fontWeight: 600 }}>Material</div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{selected.material ?? "—"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: colors.textFaint, fontWeight: 600 }}>Est. Surface Area (per part)</div>
                  <div style={{ fontFamily: fontMono, fontSize: 16, fontWeight: 700, marginTop: 2, color: colors.accentDefault }}>
                    {selected.surface_area_sq_in != null ? `${selected.surface_area_sq_in.toLocaleString(undefined, { maximumFractionDigits: 1 })} in²` : "—"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: colors.textFaint, fontWeight: 600 }}>Source</div>
                  <div style={{ fontSize: 12, marginTop: 2 }}>{selected.filename}</div>
                  <div style={{ fontSize: 10, color: colors.textMuted }}>{(selected.file_size / 1024).toFixed(0)} KB · {selected.model_used}</div>
                </div>
              </div>

              {selected.overall_thickness_in != null || selected.overall_thickness_source ? (
                <div style={{ marginTop: 12, background: "#FFF8EC", border: "1px solid #E3C888", borderRadius: 6, padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: "#8A6D1D", fontWeight: 700 }}>
                      Overall Thickness — highest-leverage dimension
                    </span>
                    <Chip kind={confKind(selected.overall_thickness_confidence)} text={`confidence: ${selected.overall_thickness_confidence ?? "—"}`} />
                  </div>
                  <div style={{ fontFamily: fontMono, fontSize: 15, fontWeight: 700, marginTop: 4, color: "#6B5314" }}>
                    {selected.overall_thickness_in != null ? `${selected.overall_thickness_in.toLocaleString(undefined, { maximumFractionDigits: 3 })} in` : "not identified"}
                  </div>
                  {selected.overall_thickness_source ? (
                    <div style={{ fontSize: 11, color: "#8A6D1D", marginTop: 3 }}>
                      Source: {selected.overall_thickness_source}
                    </div>
                  ) : null}
                  <div style={{ fontSize: 10, color: "#8A6D1D", marginTop: 4 }}>
                    This dimension often drives most of the total surface area — verify against the physical print before quoting.
                  </div>
                </div>
              ) : null}
            </div>

            <Section title="Processing Requirements">
              {(selected.processing_requirements ?? []).length === 0 ? (
                <Empty text="No finish/processing callouts found." />
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead><HeaderRow cols={["Process", "Spec", "Type / Class", "Notes"]} /></thead>
                  <tbody>
                    {(selected.processing_requirements ?? []).map((p, i) => (
                      <tr key={i} style={{ borderTop: `1px solid ${colors.rowBorder}` }}>
                        <td style={{ padding: "8px 20px", fontWeight: 600 }}>{p.process}</td>
                        <td style={{ padding: "8px 8px", fontFamily: fontMono, fontSize: 11, color: colors.accentDefault }}>{p.spec}</td>
                        <td style={{ padding: "8px 8px", fontSize: 11 }}>{p.class_type || "—"}</td>
                        <td style={{ padding: "8px 20px 8px 8px", fontSize: 11, color: colors.textMuted }}>{p.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            {(selected.masking_requirements ?? []).length > 0 ? (
              <Section title="Masking / Keep-Free Areas">
                <ul style={{ margin: 0, padding: "0 20px 12px 36px", fontSize: 12 }}>
                  {(selected.masking_requirements ?? []).map((m, i) => (
                    <li key={i} style={{ marginTop: 4 }}>{m}</li>
                  ))}
                </ul>
              </Section>
            ) : null}

            {(selected.post_treatment_requirements ?? []).length > 0 ? (
              <Section title="Post-Treatment Requirements">
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead><HeaderRow cols={["Treatment", "Spec", "Timing / Notes"]} /></thead>
                  <tbody>
                    {(selected.post_treatment_requirements ?? []).map((p, i) => (
                      <tr key={i} style={{ borderTop: `1px solid ${colors.rowBorder}` }}>
                        <td style={{ padding: "8px 20px", fontWeight: 600 }}>{p.treatment}</td>
                        <td style={{ padding: "8px 8px", fontFamily: fontMono, fontSize: 11, color: colors.accentDefault }}>{p.spec}</td>
                        <td style={{ padding: "8px 20px 8px 8px", fontSize: 11, color: colors.textMuted }}>{p.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            ) : null}

            <Section title="Surface Area Breakdown">
              {(selected.dimensions ?? []).length === 0 ? (
                <Empty text="No dimensional breakdown returned." />
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead><HeaderRow cols={["", "Feature", "Dimensions Read", "Area (in²)"]} /></thead>
                  <tbody>
                    {(selected.dimensions ?? []).map((d, i) => (
                      <tr key={i} style={{ borderTop: `1px solid ${colors.rowBorder}` }}>
                        <td style={{ padding: "8px 0 8px 20px", width: 18 }} title={d.computed ? "Verified — area computed by the app from read dimensions" : "AI-estimated — irregular shape, not independently verified"}>
                          {d.computed ? (
                            <span style={{ color: colors.green, fontSize: 12 }}>✓</span>
                          ) : (
                            <span style={{ color: colors.textFaint, fontSize: 12 }}>≈</span>
                          )}
                        </td>
                        <td style={{ padding: "8px 8px" }}>{d.feature}</td>
                        <td style={{ padding: "8px 8px", fontFamily: fontMono, fontSize: 11, color: colors.textMuted }}>{d.dimensions_text}</td>
                        <td style={{ padding: "8px 20px 8px 8px", fontFamily: fontMono, fontSize: 11 }}>
                          {d.area_sq_in != null ? d.area_sq_in.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {selected.surface_area_method ? (
                <div style={{ padding: "10px 20px 4px", fontSize: 11, color: colors.textMuted }}>
                  <span style={{ fontWeight: 700, color: colors.text }}>Method: </span>
                  {selected.surface_area_method}
                </div>
              ) : null}
              {(selected.dimensions ?? []).length > 0 ? (
                <div style={{ padding: "0 20px 14px", fontSize: 10, color: colors.textFaint }}>
                  ✓ verified by deterministic calculation · ≈ AI-estimated (irregular shape)
                </div>
              ) : null}
            </Section>

            {(selected.warnings ?? []).length > 0 ? (
              <Section title="Review Warnings">
                <div style={{ padding: "0 20px 14px" }}>
                  {(selected.warnings ?? []).map((w, i) => (
                    <div key={i} style={{ background: "#FFF8EC", border: "1px solid #E3C888", borderRadius: 6, padding: "7px 11px", fontSize: 11, color: "#8A6D1D", marginTop: 6 }}>
                      ⚠ {w}
                    </div>
                  ))}
                </div>
              </Section>
            ) : null}

            {(selected.governing_specs ?? []).length > 0 ? (
              <Section title="All Referenced Specs">
                <div style={{ padding: "0 20px 16px", display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(selected.governing_specs ?? []).map((s, i) => (
                    <span key={i} title={s.description} style={{ fontFamily: fontMono, fontSize: 11, border: `1px solid ${colors.cardBorder}`, borderRadius: 4, padding: "3px 8px", background: "#FAFBFB" }}>
                      {s.spec}
                    </span>
                  ))}
                </div>
              </Section>
            ) : null}
          </>
        )}
      </Card>
    </section>
  );
}
