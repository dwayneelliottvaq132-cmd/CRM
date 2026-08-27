import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { colors, fontMono } from "../lib/theme";
import { useAttachments, useBatchCandidates, useBatchSignoffOp, useJob, useJobs, useReportProblem, useSignoffOp, useStartOp } from "../lib/queries";
import { ItarBadge } from "../components/Chip";
import { AttachmentGallery } from "../components/AttachmentGallery";

type MsgKind = "ok" | "warn" | "error";

/** Process-instruction / quality-alert photos and videos for the operator's current
 * step — sourced from the RoutingStep this op was cloned from. Hidden entirely when
 * that step has none, so most jobs' shop-floor screens look exactly as before. */
function StepMedia({ routingStepId }: { routingStepId: number }) {
  const { data: attachments } = useAttachments("routing_step", routingStepId);
  if (!attachments || attachments.length === 0) return null;
  const hasAlert = attachments.some((a) => a.is_quality_alert);
  return (
    <div
      style={{
        marginTop: 16, padding: 16, borderRadius: 8,
        background: hasAlert ? "#FBEFEF" : "#F6F8F5",
        border: `1px solid ${hasAlert ? colors.red : colors.rowBorder}`,
      }}
    >
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: hasAlert ? colors.red : colors.textFaint, fontWeight: 700, marginBottom: 10 }}>
        {hasAlert ? "⚠ Quality Alert — Process Reference" : "Process Reference"}
      </div>
      <AttachmentGallery entityType="routing_step" entityId={routingStepId} readOnly />
    </div>
  );
}

function targetHint(kind: string, targetMin: number | null, targetMax: number | null, targetText: string | null): string | null {
  if (kind === "text") return targetText ? `target: ${targetText}` : null;
  if (targetMin != null && targetMax != null) return `target: ${targetMin}–${targetMax}`;
  if (targetMin != null) return `target: ≥${targetMin}`;
  if (targetMax != null) return `target: ≤${targetMax}`;
  return null;
}

export function ShopFloorPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { data: jobs } = useJobs();

  const openJobs = useMemo(() => (jobs ?? []).filter((j) => j.status !== "Complete"), [jobs]);
  const defaultJobId = openJobs[0]?.id ?? jobs?.[0]?.id;
  const selectedId = jobId ?? defaultJobId;

  useEffect(() => {
    if (!jobId && defaultJobId) navigate(`/shopfloor/${defaultJobId}`, { replace: true });
  }, [jobId, defaultJobId, navigate]);

  const { data: job } = useJob(selectedId);
  const startMutation = useStartOp();
  const signoffMutation = useSignoffOp();
  const batchSignoffMutation = useBatchSignoffOp();
  const reportMutation = useReportProblem();
  const { data: batchCandidates } = useBatchCandidates(job?.status !== "Complete" ? job?.id : undefined);

  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<{ text: string; kind: MsgKind } | null>(null);
  const [running, setRunning] = useState(false);
  const [readings, setReadings] = useState<Record<string, string>>({});
  const [showReport, setShowReport] = useState(false);
  const [reportText, setReportText] = useState("");
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());

  const curIdx = job?.ops.findIndex((o) => !o.done) ?? -1;
  const floorOp = job ? (curIdx >= 0 ? job.ops[curIdx] : job.ops[job.ops.length - 1]) : undefined;
  const allDone = curIdx < 0;
  const onHold = job?.status === "Hold — NCR";
  const needsPlanning = job?.planning_status === "Needs Planning";

  useEffect(() => {
    setReadings({});
  }, [floorOp?.id]);

  // Auto-suggest: default every matched job to selected, operator can uncheck any.
  useEffect(() => {
    setSelectedBatchIds(new Set((batchCandidates ?? []).map((c) => c.id)));
  }, [batchCandidates]);

  function toggleBatchJob(id: string) {
    setSelectedBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function requirePin(): boolean {
    if (pin.length < 4) {
      setMsg({ text: "Enter your 4–6 digit PIN", kind: "error" });
      return false;
    }
    return true;
  }

  function requireReadings(): boolean {
    const missing = (floorOp?.required_parameters ?? []).filter(
      (p) => p.required && !p.auto_computed && !readings[p.key]?.trim()
    );
    if (missing.length > 0) {
      setMsg({ text: `Enter a value for: ${missing.map((p) => p.label).join(", ")}`, kind: "error" });
      return false;
    }
    return true;
  }

  async function handleStart() {
    if (!job || !floorOp || !requirePin()) return;
    try {
      await startMutation.mutateAsync({ jobId: job.id, seq: floorOp.seq, pin });
      setRunning(true);
      setMsg({ text: "Op started — clock running", kind: "ok" });
    } catch (err: unknown) {
      setMsg({ text: extractError(err), kind: "error" });
    }
  }

  async function handleComplete() {
    if (!job || !floorOp || !requirePin() || !requireReadings()) return;
    const readingsPayload = (floorOp.required_parameters ?? [])
      .filter((p) => !p.auto_computed && readings[p.key]?.trim())
      .map((p) => ({ key: p.key, value: p.kind === "text" ? readings[p.key] : Number(readings[p.key]) }));
    const batchJobIds = Array.from(selectedBatchIds);
    try {
      let signedOp;
      let jobCount = 1;
      if (batchJobIds.length > 0) {
        const results = await batchSignoffMutation.mutateAsync({
          jobIds: [job.id, ...batchJobIds], pin, readings: readingsPayload,
        });
        jobCount = results.length;
        const thisJob = results.find((r) => r.id === job.id);
        signedOp = thisJob?.ops.find((o) => o.seq === floorOp.seq);
      } else {
        const result = await signoffMutation.mutateAsync({ jobId: job.id, seq: floorOp.seq, pin, readings: readingsPayload });
        signedOp = result.ops.find((o) => o.seq === floorOp.seq);
      }
      setRunning(false);
      setPin("");
      setReadings({});
      const oosReading = signedOp?.recorded_parameters.find((r) => r.in_spec === false);
      const jobsNote = jobCount > 1 ? ` — ${jobCount} jobs batch signed off` : "";
      if (oosReading) {
        setMsg({
          text: `Signed off${jobsNote} — OUT OF SPEC: ${oosReading.label} ${oosReading.value}${oosReading.unit} (target ${oosReading.target_min}–${oosReading.target_max}). Flagged for Quality review.`,
          kind: "warn",
        });
      } else {
        setMsg({ text: `Signed off ✓${jobsNote} — next op loaded`, kind: "ok" });
      }
    } catch (err: unknown) {
      setMsg({ text: extractError(err), kind: "error" });
    }
  }

  async function handleReport() {
    if (!job || !requirePin()) return;
    if (!reportText.trim()) {
      setMsg({ text: "Describe the problem before reporting", kind: "error" });
      return;
    }
    try {
      await reportMutation.mutateAsync({ jobId: job.id, pin, description: reportText.trim() });
      setShowReport(false);
      setReportText("");
      setPin("");
      setRunning(false);
      setMsg({ text: "Problem reported — NCR opened and job placed on Hold. Quality has been notified.", kind: "warn" });
    } catch (err: unknown) {
      setMsg({ text: extractError(err), kind: "error" });
    }
  }

  if (job && needsPlanning) {
    return (
      <section style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ background: "#FBEFEF", border: `1px solid ${colors.red}`, borderRadius: 8, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.red }}>⛔ {job.id} has not completed Planning</div>
          <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 8 }}>
            No traveler operations exist yet — this job needs a plan before shop-floor work can begin.
          </div>
          <button
            onClick={() => navigate("/planning")}
            style={{ marginTop: 16, background: colors.accentDefault, color: "#FFFFFF", border: "none", borderRadius: 6, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Go to Planning →
          </button>
        </div>
      </section>
    );
  }

  if (!job || !floorOp) return <div style={{ fontSize: 13, color: colors.textFaint }}>Loading…</div>;

  return (
    <section style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ background: "#FFFFFF", border: `1px solid ${colors.cardBorder}`, borderRadius: 8, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 24px", background: colors.sidebarBg }}>
          <span style={{ fontFamily: fontMono, fontSize: 20, fontWeight: 700, color: "#FFFFFF" }}>{job.id}</span>
          <span style={{ fontSize: 13, color: "#9BA6AD" }}>
            {job.customer.name} · {job.part_number} · Qty {job.qty}
          </span>
          {job.itar ? <ItarBadge /> : null}
          <span style={{ marginLeft: "auto", fontFamily: fontMono, fontSize: 13, color: "#9BA6AD" }}>
            Op {floorOp.seq} of {job.ops[job.ops.length - 1].seq}
          </span>
        </div>

        <div style={{ padding: 24 }}>
          {onHold ? (
            <div style={{ marginBottom: 16, padding: "12px 16px", background: "#FBEFEF", border: `1px solid ${colors.red}`, borderRadius: 8, fontSize: 13, fontWeight: 600, color: colors.red }}>
              ⛔ Job is on NCR HOLD — an operator reported a problem. Sign-off is blocked until Quality dispositions the nonconformance and lifts the hold.
            </div>
          ) : null}
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: colors.textFaint, fontWeight: 600 }}>Current Operation</div>
          <div style={{ fontSize: 30, fontWeight: 700, marginTop: 4 }}>{allDone ? "All operations complete ✓" : floorOp.name}</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 16 }}>
            <InfoBox label="Parameters" value={floorOp.parameters} />
            <InfoBox label="Work Instruction" value={floorOp.work_instruction_doc_no ?? "—"} link />
            <InfoBox label="Governing Spec" value={job.spec} color={colors.accentDefault} />
          </div>

          {!allDone && floorOp.source_routing_step_id ? (
            <StepMedia routingStepId={floorOp.source_routing_step_id} />
          ) : null}

          {(floorOp.required_parameters ?? []).length > 0 ? (
            <div style={{ marginTop: 16, padding: 16, background: "#F6F8F5", border: `1px solid ${colors.rowBorder}`, borderRadius: 8 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: colors.textFaint, fontWeight: 600, marginBottom: 10 }}>
                Recorded Values
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                {floorOp.required_parameters.map((p) => (
                  <div key={p.key}>
                    <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                      {p.label}
                      {p.unit ? ` (${p.unit})` : ""}
                      {p.required ? "" : " — optional"}
                    </div>
                    {p.auto_computed && p.kind === "duration" ? (
                      <div style={{ fontSize: 12, fontStyle: "italic", color: colors.textFaint, padding: "10px 0" }}>
                        computed automatically at signoff
                      </div>
                    ) : (
                      <input
                        value={readings[p.key] ?? ""}
                        onChange={(e) => setReadings((r) => ({ ...r, [p.key]: e.target.value }))}
                        type={p.kind === "text" ? "text" : "number"}
                        disabled={allDone}
                        style={{ border: "1px solid #C9CFC9", borderRadius: 6, padding: "8px 10px", fontSize: 14, fontFamily: fontMono, width: "100%", boxSizing: "border-box" }}
                      />
                    )}
                    {targetHint(p.kind, p.target_min, p.target_max, p.target_text) ? (
                      <div style={{ fontSize: 10, color: colors.textFaint, marginTop: 3 }}>
                        {targetHint(p.kind, p.target_min, p.target_max, p.target_text)}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!allDone && !onHold && (batchCandidates ?? []).length > 0 ? (
            <div style={{ marginTop: 16, padding: 16, background: "#F4F8FB", border: `1px solid #B7CBD9`, borderRadius: 8 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: colors.accentDefault, fontWeight: 700, marginBottom: 4 }}>
                Also at {floorOp.tank_id ? `Tank ${floorOp.tank_id}` : `Equipment ${floorOp.equipment_id}`} — {floorOp.name}
              </div>
              <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 10 }}>
                {batchCandidates!.length} other job(s) are on the same process right now — checked jobs get the same readings
                and PIN, signed off together. Uncheck any that don't belong in this batch.
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {batchCandidates!.map((c) => (
                  <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={selectedBatchIds.has(c.id)}
                      onChange={() => toggleBatchJob(c.id)}
                    />
                    <span style={{ fontFamily: fontMono, fontWeight: 600, color: colors.accentDefault }}>{c.id}</span>
                    <span style={{ color: colors.textMuted }}>{c.customer.name} · {c.part_number}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 24, padding: 16, background: "#F6F8F5", border: `1px solid ${colors.rowBorder}`, borderRadius: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: colors.textFaint, fontWeight: 600, marginBottom: 6 }}>Operator PIN</div>
              <input
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setMsg(null);
                }}
                type="password"
                placeholder="••••"
                maxLength={6}
                disabled={allDone}
                style={{ border: "1px solid #C9CFC9", borderRadius: 6, padding: "12px 14px", fontSize: 20, fontFamily: fontMono, letterSpacing: "0.3em", width: 150 }}
              />
              {msg ? (
                <span style={{ fontSize: 12, color: msg.kind === "ok" ? colors.green : msg.kind === "warn" ? "#8A6D1D" : colors.red, marginLeft: 12 }}>
                  {msg.text}
                </span>
              ) : null}
            </div>
            <button
              onClick={handleStart}
              disabled={allDone || onHold || startMutation.isPending}
              style={{
                minHeight: 56,
                padding: "0 28px",
                fontSize: 16,
                fontWeight: 700,
                borderRadius: 8,
                border: `1px solid ${running ? "#E3CD9E" : "#C9CFC9"}`,
                background: running ? "#F4E9D4" : "#FFFFFF",
                color: running ? "#7A5A1E" : colors.text,
                cursor: allDone || onHold ? "default" : "pointer",
                opacity: onHold ? 0.5 : 1,
              }}
            >
              {running ? "⏱ Running…" : "Start Op"}
            </button>
            <button
              onClick={handleComplete}
              disabled={allDone || onHold || signoffMutation.isPending || batchSignoffMutation.isPending}
              style={{ minHeight: 56, padding: "0 28px", fontSize: 16, fontWeight: 700, borderRadius: 8, border: "none", background: colors.green, color: "#FFFFFF", cursor: allDone || onHold ? "default" : "pointer", opacity: onHold ? 0.5 : 1 }}
            >
              {selectedBatchIds.size > 0 ? `Sign Off ${selectedBatchIds.size + 1} Jobs ✓` : "Sign Off & Complete ✓"}
            </button>
          </div>

          {!allDone && !onHold ? (
            showReport ? (
              <div style={{ marginTop: 12, padding: 16, background: "#FBEFEF", border: `1px solid ${colors.red}`, borderRadius: 8 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: colors.red, fontWeight: 700, marginBottom: 8 }}>
                  Report a Nonconformance — this opens an NCR and holds the job
                </div>
                <textarea
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder="Describe the problem (what's wrong, where, how many parts affected)…"
                  rows={3}
                  style={{ width: "100%", boxSizing: "border-box", border: "1px solid #C9CFC9", borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: "inherit" }}
                />
                <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 6 }}>
                  Enter your PIN above to attribute the report. The job will go to <strong>Hold — NCR</strong> and no further ops can be signed until Quality dispositions it.
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    onClick={handleReport}
                    disabled={reportMutation.isPending}
                    style={{ padding: "8px 16px", fontSize: 13, fontWeight: 700, borderRadius: 6, border: "none", background: colors.red, color: "#FFFFFF", cursor: "pointer" }}
                  >
                    {reportMutation.isPending ? "Reporting…" : "Open NCR & Hold Job"}
                  </button>
                  <button
                    onClick={() => { setShowReport(false); setReportText(""); }}
                    style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: 6, border: `1px solid ${colors.cardBorder}`, background: "#FFFFFF", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setShowReport(true); setMsg(null); }}
                style={{ marginTop: 12, padding: "8px 14px", fontSize: 13, fontWeight: 600, borderRadius: 6, border: `1px solid ${colors.red}`, background: "#FFFFFF", color: colors.red, cursor: "pointer" }}
              >
                ⚠ Report Problem / Hold
              </button>
            )
          ) : null}

          <div style={{ fontSize: 11, color: colors.textFaint, marginTop: 10 }}>
            Sign-off records operator ID, timestamp, and actual process parameters against this operation — this is the paperless traveler record used for NADCAP job audits.
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${colors.rowBorder}`, padding: "14px 24px" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: colors.textFaint, fontWeight: 600, marginBottom: 8 }}>Route Progress</div>
          <div style={{ display: "flex", gap: 6 }}>
            {job.ops.map((op, i) => (
              <div
                key={op.id}
                title={`${op.seq} ${op.name}`}
                style={{ flex: 1, height: 8, borderRadius: 4, background: op.done ? colors.green : i === curIdx ? colors.accentDefault : colors.cardBorder }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function InfoBox({ label, value, link, color }: { label: string; value: string; link?: boolean; color?: string }) {
  return (
    <div style={{ background: "#F6F8F5", border: `1px solid ${colors.rowBorder}`, borderRadius: 6, padding: "12px 14px" }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: colors.textFaint, fontWeight: 600 }}>{label}</div>
      {link ? (
        <div style={{ marginTop: 4 }}>
          <a href="#" style={{ fontFamily: fontMono, fontSize: 14, fontWeight: 600 }}>{value}</a>
        </div>
      ) : (
        <div style={{ fontFamily: fontMono, fontSize: 14, fontWeight: 600, marginTop: 4, color }}>{value}</div>
      )}
    </div>
  );
}

function extractError(err: unknown): string {
  const e = err as { response?: { data?: { detail?: string } } };
  return e?.response?.data?.detail ?? "Something went wrong";
}
