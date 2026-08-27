import { useEffect, useState } from "react";
import { certPdfUrl } from "../api/endpoints";
import { certStateKind, colors, fontMono } from "../lib/theme";
import { useCertQueue, useIssueCertificate, useJob } from "../lib/queries";
import { useAuth } from "../context/AuthContext";
import { Chip } from "../components/Chip";

export function CertsPage() {
  const { data: queue, isLoading } = useCertQueue();
  const [selected, setSelected] = useState<string | undefined>();
  const { user } = useAuth();
  const issue = useIssueCertificate();
  const [issueError, setIssueError] = useState("");

  useEffect(() => {
    if (!selected && queue && queue.length) setSelected(queue[0].job_id);
  }, [queue, selected]);

  const item = queue?.find((q) => q.job_id === selected);
  const { data: job } = useJob(selected);

  return (
    <section style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16, alignItems: "start" }}>
      <div style={{ background: "#FFFFFF", border: `1px solid ${colors.cardBorder}`, borderRadius: 6 }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.rowBorder}`, fontSize: 13, fontWeight: 700 }}>Awaiting Certification</div>
        {isLoading || !queue ? (
          <div style={{ padding: 16, fontSize: 12 }}>Loading…</div>
        ) : (
          queue.map((cq) => (
            <div
              key={cq.job_id}
              onClick={() => setSelected(cq.job_id)}
              className="row-hover"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 16px",
                borderTop: `1px solid ${colors.rowBorder}`,
                fontSize: 12,
                cursor: "pointer",
                background: cq.job_id === selected ? "#F0F5F8" : undefined,
              }}
            >
              <span style={{ fontFamily: fontMono, fontWeight: 600, color: colors.accentDefault }}>{cq.job_id}</span>
              <span style={{ flex: 1 }}>
                {cq.customer_name} · {cq.process_label}
              </span>
              <Chip kind={certStateKind(cq.state)} text={cq.state} />
            </div>
          ))
        )}
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${colors.rowBorder}`, fontSize: 11, color: colors.textFaint }}>
          C of C generates automatically from traveler sign-offs + bath analysis records. It cannot be issued if any operation is unsigned or a linked tank was out of control during processing.
        </div>
      </div>

      <div style={{ background: "#FFFFFF", border: "1px solid #C9CFC9", borderRadius: 4, padding: "32px 36px", fontSize: 12, boxShadow: "0 1px 4px rgba(20,30,35,0.08)" }}>
        {!job || !item ? (
          <div style={{ fontSize: 12, color: colors.textFaint }}>Select a job to preview its certificate.</div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: "2px solid #22282C", paddingBottom: 10 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.02em" }}>TEXAS PRECISION PLATING</div>
                <div style={{ fontSize: 10, color: colors.textMuted }}>Certificate of Conformance</div>
              </div>
              <div style={{ fontFamily: fontMono, fontSize: 11, textAlign: "right" }}>
                <div>{item.certificate_id ?? "— not yet issued —"}</div>
                <div style={{ color: colors.textMuted }}>{new Date().toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px", marginTop: 14, fontSize: 12 }}>
              <div>
                <span style={{ color: colors.textFaint }}>Customer:</span> <strong>{job.customer.name}</strong>
              </div>
              <div>
                <span style={{ color: colors.textFaint }}>PO:</span> <span style={{ fontFamily: fontMono }}>{job.customer_po}</span>
              </div>
              <div>
                <span style={{ color: colors.textFaint }}>Part:</span> <span style={{ fontFamily: fontMono }}>{job.part_number} Rev {job.revision}</span>
              </div>
              <div>
                <span style={{ color: colors.textFaint }}>Qty Accepted:</span> <span style={{ fontFamily: fontMono }}>{job.qty} / {job.qty}</span>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <span style={{ color: colors.textFaint }}>Process:</span> <strong>{job.process_label} — {job.spec}</strong>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <span style={{ color: colors.textFaint }}>Job:</span> <span style={{ fontFamily: fontMono }}>{job.id}</span> · processed per TPP work instructions · sealed per governing spec
              </div>
            </div>
            <p style={{ margin: "16px 0 0 0", fontSize: 11, lineHeight: 1.55, color: "#3A4348" }}>
              Certification: The parts listed above were processed in accordance with the specification(s) and revision(s) noted. Process solutions were within
              control limits during processing (analysis records on file). Records are retained per AS9100D §7.5 and are available for review.
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28, alignItems: "flex-end" }}>
              <div>
                <div style={{ fontFamily: fontMono, fontSize: 13, borderBottom: "1px solid #22282C", padding: "0 30px 4px 0" }}>{user?.name}</div>
                <div style={{ fontSize: 10, color: colors.textFaint, marginTop: 4 }}>Quality Manager · e-signed on issue</div>
              </div>
              {item.certificate_id ? (
                <a
                  href={certPdfUrl(item.certificate_id)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ background: colors.accentDefault, color: "#FFFFFF", border: "none", borderRadius: 5, padding: "8px 14px", fontSize: 12, fontWeight: 600, textDecoration: "none" }}
                >
                  Download C of C PDF
                </a>
              ) : (
                <button
                  disabled={!item.ready || issue.isPending}
                  onClick={() => {
                    setIssueError("");
                    issue.mutate(job.id, { onError: (e: unknown) => setIssueError(extractError(e)) });
                  }}
                  style={{
                    background: item.ready ? colors.accentDefault : colors.cardBorder,
                    color: item.ready ? "#FFFFFF" : colors.textFaint,
                    border: "none",
                    borderRadius: 5,
                    padding: "8px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: item.ready ? "pointer" : "not-allowed",
                  }}
                >
                  {issue.isPending ? "Issuing…" : "Issue & Email PDF"}
                </button>
              )}
            </div>
            {!item.ready && !item.certificate_id ? <div style={{ marginTop: 8, fontSize: 11, color: colors.red, textAlign: "right" }}>{item.state}</div> : null}
            {issueError ? <div style={{ marginTop: 8, fontSize: 11, color: colors.red, textAlign: "right" }}>{issueError}</div> : null}
          </>
        )}
      </div>
    </section>
  );
}

function extractError(err: unknown): string {
  const e = err as { response?: { data?: { detail?: string } } };
  return e?.response?.data?.detail ?? "Could not issue certificate.";
}
