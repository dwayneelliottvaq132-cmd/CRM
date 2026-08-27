import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { colors, fontMono, jobOrderStatusKind } from "../lib/theme";
import { fmtDateTime, fmtDateYear } from "../lib/format";
import {
  useCreateJob,
  useCustomers,
  useDeleteJob,
  useDrawingAnalysis,
  useJob,
  useJobs,
  useResolveSpecResult,
  useRoutingRevision,
  useShipJob,
  useUpdateJob,
} from "../lib/queries";
import { useAuth } from "../context/AuthContext";
import { Card } from "../components/Table";
import { Chip, ItarBadge, SmallChip } from "../components/Chip";
import { Field as ModalField, FormError, Modal, PrimaryButton, SecondaryButton, Select, TextInput } from "../components/Modal";
import { RequirementsPanel } from "../components/RequirementsPanel";
import { JobBarcode } from "../components/JobBarcode";
import type { JobDetail } from "../lib/types";

function NewJobModal({ onClose, onCreated }: { onClose: () => void; onCreated: (jobId: string) => void }) {
  const { data: customers } = useCustomers();
  const createJob = useCreateJob();
  const [customerId, setCustomerId] = useState("");
  const [customerPo, setCustomerPo] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [revision, setRevision] = useState("A");
  const [qty, setQty] = useState("");
  const [spec, setSpec] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!customerId || !customerPo || !partNumber || !qty || !spec) {
      setError("All fields except due date are required.");
      return;
    }
    try {
      const job = await createJob.mutateAsync({
        customer_id: Number(customerId),
        customer_po: customerPo,
        part_number: partNumber,
        revision,
        qty: Number(qty),
        spec,
        due_date: dueDate || null,
      });
      onCreated(job.id);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Failed to create job.");
    }
  }

  return (
    <Modal
      title="New Job"
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={handleSubmit} disabled={createJob.isPending}>
            {createJob.isPending ? "Creating…" : "Create Job"}
          </PrimaryButton>
        </>
      }
    >
      <FormError message={error} />
      <ModalField label="Customer">
        <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Select customer…</option>
          {(customers ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </ModalField>
      <ModalField label="Customer PO">
        <TextInput value={customerPo} onChange={(e) => setCustomerPo(e.target.value)} placeholder="PO-48213" />
      </ModalField>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <ModalField label="Part Number">
          <TextInput value={partNumber} onChange={(e) => setPartNumber(e.target.value)} placeholder="10847-3" />
        </ModalField>
        <ModalField label="Revision">
          <TextInput value={revision} onChange={(e) => setRevision(e.target.value)} />
        </ModalField>
      </div>
      <ModalField label="Governing Spec">
        <TextInput value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="MIL-A-8625 Type II Class 1" />
      </ModalField>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <ModalField label="Qty">
          <TextInput type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
        </ModalField>
        <ModalField label="Due Date" hint="Optional">
          <TextInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </ModalField>
      </div>
    </Modal>
  );
}

function EditJobModal({ job, onClose }: { job: JobDetail; onClose: () => void }) {
  const updateJob = useUpdateJob();
  const [customerPo, setCustomerPo] = useState(job.customer_po);
  const [partNumber, setPartNumber] = useState(job.part_number);
  const [revision, setRevision] = useState(job.revision);
  const [qty, setQty] = useState(String(job.qty));
  const [spec, setSpec] = useState(job.spec);
  const [dueDate, setDueDate] = useState(job.due_date ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!customerPo || !partNumber || !qty || !spec) {
      setError("All fields except due date are required.");
      return;
    }
    try {
      await updateJob.mutateAsync({
        id: job.id,
        body: { customer_po: customerPo, part_number: partNumber, revision, qty: Number(qty), spec, due_date: dueDate || null },
      });
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Failed to save job.");
    }
  }

  return (
    <Modal
      title={`Edit ${job.id}`}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={handleSubmit} disabled={updateJob.isPending}>
            {updateJob.isPending ? "Saving…" : "Save Changes"}
          </PrimaryButton>
        </>
      }
    >
      <FormError message={error} />
      <ModalField label="Customer" hint="Customer can't be changed after creation">
        <TextInput value={job.customer.name} disabled />
      </ModalField>
      <ModalField label="Customer PO">
        <TextInput autoFocus value={customerPo} onChange={(e) => setCustomerPo(e.target.value)} />
      </ModalField>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <ModalField label="Part Number">
          <TextInput value={partNumber} onChange={(e) => setPartNumber(e.target.value)} />
        </ModalField>
        <ModalField label="Revision">
          <TextInput value={revision} onChange={(e) => setRevision(e.target.value)} />
        </ModalField>
      </div>
      <ModalField label="Governing Spec">
        <TextInput value={spec} onChange={(e) => setSpec(e.target.value)} />
      </ModalField>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <ModalField label="Qty">
          <TextInput type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
        </ModalField>
        <ModalField label="Due Date" hint="Optional">
          <TextInput type="date" value={dueDate ?? ""} onChange={(e) => setDueDate(e.target.value)} />
        </ModalField>
      </div>
    </Modal>
  );
}

export function TravelersPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { data: jobs } = useJobs();
  const { user } = useAuth();
  const shipMutation = useShipJob();
  const resolveMutation = useResolveSpecResult();
  const [shipError, setShipError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [showNewJob, setShowNewJob] = useState(false);
  const [showEditJob, setShowEditJob] = useState(false);
  const [confirmDeleteJob, setConfirmDeleteJob] = useState(false);
  const deleteJob = useDeleteJob();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openJobs = useMemo(() => (jobs ?? []).filter((j) => j.status !== "Complete"), [jobs]);
  const defaultJobId = openJobs[0]?.id ?? jobs?.[0]?.id;
  const selectedId = jobId ?? defaultJobId;

  useEffect(() => {
    if (!jobId && defaultJobId) navigate(`/travelers/${defaultJobId}`, { replace: true });
  }, [jobId, defaultJobId, navigate]);

  const { data: job } = useJob(selectedId);
  const { data: sourceRevision } = useRoutingRevision(job?.source_routing_revision_id ?? undefined);
  const { data: sourceDrawing } = useDrawingAnalysis(sourceRevision?.source_drawing_analysis_id ?? undefined);

  const curIdx = job?.ops.findIndex((o) => !o.done) ?? -1;

  return (
    <section style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, alignItems: "start" }}>
      <Card>
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${colors.rowBorder}`, display: "flex", alignItems: "center", fontSize: 13, fontWeight: 700 }}>
          Active Jobs
          <button
            onClick={() => setShowNewJob(true)}
            style={{ marginLeft: "auto", background: colors.accentDefault, color: "#FFFFFF", border: "none", borderRadius: 4, padding: "4px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
          >
            + New Job
          </button>
        </div>
        {(jobs ?? []).map((jl) => {
          const active = jl.id === selectedId;
          return (
            <div
              key={jl.id}
              onClick={() => navigate(`/travelers/${jl.id}`)}
              className="row-hover"
              style={{
                padding: "10px 14px",
                borderTop: `1px solid ${colors.rowBorder}`,
                cursor: "pointer",
                background: active ? "#F0F5F8" : "transparent",
                borderLeft: `3px solid ${active ? colors.accentDefault : "transparent"}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: fontMono, fontSize: 12, fontWeight: 600, color: colors.accentDefault }}>{jl.id}</span>
                <SmallChip kind={jobOrderStatusKind(jl.status)} text={jl.status} />
              </div>
              <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}>
                {jl.customer.name} · {jl.process_label}
              </div>
            </div>
          );
        })}
      </Card>

      <Card>
        {!job ? (
          <div style={{ padding: 24, fontSize: 12 }}>Select a job.</div>
        ) : (
          <>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${colors.rowBorder}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: fontMono, fontSize: 17, fontWeight: 700 }}>{job.id}</span>
                <Chip kind={jobOrderStatusKind(job.status)} text={job.status} />
                {job.itar ? <ItarBadge /> : null}
                {job.planning_status === "Needs Planning" ? (
                  <Chip kind="bad" text="Needs Planning" />
                ) : job.routing_planned ? (
                  <Chip kind="good" text={job.source_routing_revision_label ?? "Plan"} />
                ) : (
                  <Chip kind="warn" text="No approved plan" />
                )}
                <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => window.print()}
                    style={{ background: "#FFFFFF", color: colors.text, border: `1px solid ${colors.cardBorder}`, borderRadius: 5, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    Print Barcode
                  </button>
                  <button
                    onClick={() => setShowEditJob(true)}
                    style={{ background: "#FFFFFF", color: colors.text, border: `1px solid ${colors.cardBorder}`, borderRadius: 5, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    Edit
                  </button>
                  {job.status === "Queued" && !job.ops.some((o) => o.done) && job.spec_results.length === 0 ? (
                    confirmDeleteJob ? (
                      <>
                        <button
                          onClick={() => {
                            setDeleteError(null);
                            deleteJob.mutate(job.id, {
                              onSuccess: () => navigate("/travelers"),
                              onError: (err: unknown) => {
                                const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
                                setDeleteError(detail ?? "Delete failed");
                              },
                            });
                          }}
                          disabled={deleteJob.isPending}
                          style={{ background: colors.red, color: "#FFFFFF", border: "none", borderRadius: 5, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          {deleteJob.isPending ? "Deleting…" : "Confirm Delete"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteJob(false)}
                          style={{ background: "#FFFFFF", color: colors.text, border: `1px solid ${colors.cardBorder}`, borderRadius: 5, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteJob(true)}
                        style={{ background: "#FFFFFF", color: colors.red, border: `1px solid ${colors.red}`, borderRadius: 5, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        Delete
                      </button>
                    )
                  ) : null}
                  <button
                    onClick={() => navigate(`/shopfloor/${job.id}`)}
                    disabled={job.planning_status === "Needs Planning"}
                    title={job.planning_status === "Needs Planning" ? "Complete Planning for this job first" : undefined}
                    style={{
                      background: job.planning_status === "Needs Planning" ? "#E8ECEA" : colors.accentDefault,
                      color: job.planning_status === "Needs Planning" ? "#8A948E" : "#FFFFFF",
                      border: "none", borderRadius: 5, padding: "7px 12px", fontSize: 12, fontWeight: 600,
                      cursor: job.planning_status === "Needs Planning" ? "default" : "pointer",
                    }}
                  >
                    Open on Shop Floor →
                  </button>
                  {job.status !== "Shipped" ? (
                    <button
                      onClick={() => {
                        setShipError(null);
                        shipMutation.mutate(job.id, {
                          onError: (err: unknown) => {
                            const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
                            setShipError(detail ?? "Ship failed");
                          },
                        });
                      }}
                      disabled={shipMutation.isPending}
                      title={job.ship_ready ? "Ship this job" : job.ship_blockers.join("\n")}
                      style={{
                        background: job.ship_ready ? colors.green : "#E8ECEA",
                        color: job.ship_ready ? "#FFFFFF" : "#8A948E",
                        border: "none",
                        borderRadius: 5,
                        padding: "7px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {shipMutation.isPending ? "Shipping…" : "Ship ▸"}
                    </button>
                  ) : null}
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <JobBarcode value={job.id} />
              </div>
              {!job.ship_ready && job.status !== "Shipped" && job.ship_blockers.some((b) => b.startsWith("FAILED SPEC")) ? (
                <div style={{ marginTop: 12, background: "#FBEFEF", border: `1px solid ${colors.red}`, borderRadius: 6, padding: "8px 12px", fontSize: 12, color: colors.red, fontWeight: 600 }}>
                  ⛔ Shipment blocked — {job.ship_blockers.filter((b) => b.startsWith("FAILED SPEC")).join(" · ")}
                </div>
              ) : null}
              {job.planning_status === "Needs Planning" ? (
                <div style={{ marginTop: 12, background: "#FBEFEF", border: `1px solid ${colors.red}`, borderRadius: 6, padding: "8px 12px", fontSize: 12, color: colors.red, fontWeight: 600 }}>
                  ⛔ Planning not complete — this job cannot start on the shop floor.{" "}
                  <a href="/planning" onClick={(e) => { e.preventDefault(); navigate("/planning"); }} style={{ color: colors.red, textDecoration: "underline" }}>
                    Complete Planning →
                  </a>
                </div>
              ) : job.routing_warning ? (
                <div style={{ marginTop: 12, background: "#FBF3E4", border: `1px solid ${colors.amber}`, borderRadius: 6, padding: "8px 12px", fontSize: 12, color: colors.amber, fontWeight: 600 }}>
                  ⚠ {job.routing_warning}
                </div>
              ) : null}
              {shipError ? (
                <div style={{ marginTop: 12, background: "#FBEFEF", border: `1px solid ${colors.red}`, borderRadius: 6, padding: "8px 12px", fontSize: 12, color: colors.red }}>
                  {shipError}
                </div>
              ) : null}
              {deleteError ? (
                <div style={{ marginTop: 12, background: "#FBEFEF", border: `1px solid ${colors.red}`, borderRadius: 6, padding: "8px 12px", fontSize: 12, color: colors.red }}>
                  {deleteError}
                </div>
              ) : null}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 14 }}>
                <Field label="Customer / PO" value={job.customer.name} sub={job.customer_po} mono={false} />
                <Field label="Part / Rev" value={`${job.part_number} Rev ${job.revision}`} sub={`Qty ${job.qty} · Lot ${job.material_lot}`} mono />
                <Field label="Governing Spec" value={job.spec} sub={job.spec_note} mono color={colors.accentDefault} />
                <Field label="Due Date" value={fmtDateYear(job.due_date)} sub={job.due_note} mono color={jobOrderStatusKind(job.status) === "bad" ? colors.red : undefined} />
              </div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {["Op", "Operation", "Parameters", "Work Instruction", "Sign-off", "Status"].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: i === 0 ? "9px 20px" : i === 5 ? "9px 20px" : "9px 8px",
                        fontSize: 10,
                        letterSpacing: "0.07em",
                        textTransform: "uppercase",
                        color: colors.textFaint,
                        fontWeight: 600,
                        width: i === 0 ? 40 : undefined,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {job.ops.map((op, i) => {
                  const isCurrent = i === curIdx;
                  const kind = op.done ? "good" : isCurrent ? "info" : "neutral";
                  return (
                    <tr key={op.id} style={{ borderTop: `1px solid ${colors.rowBorder}`, background: isCurrent ? "#F4F8FB" : "transparent" }}>
                      <td style={{ padding: "9px 20px", fontFamily: fontMono, color: colors.textFaint }}>{op.seq}</td>
                      <td style={{ padding: "9px 8px", fontWeight: 600 }}>{op.name}</td>
                      <td style={{ padding: "9px 8px", fontFamily: fontMono, fontSize: 11, color: colors.textMuted }}>{op.parameters}</td>
                      <td style={{ padding: "9px 8px" }}>{op.work_instruction_doc_no ? <a href="#">{op.work_instruction_doc_no}</a> : "—"}</td>
                      <td style={{ padding: "9px 8px", fontSize: 11 }}>
                        <span style={{ fontFamily: fontMono, color: op.done ? colors.green : "#B4BCB6" }}>
                          {op.done ? `${op.signed_by} · ${fmtDateTime(op.signed_at)}` : "—"}
                        </span>
                      </td>
                      <td style={{ padding: "9px 20px" }}>
                        <Chip kind={kind} text={op.done ? "Complete" : isCurrent ? "Current" : "Pending"} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {job.spec_results.length > 0 ? (
              <div style={{ borderTop: `1px solid ${colors.rowBorder}` }}>
                <div style={{ padding: "12px 20px 4px", fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", color: colors.textFaint, fontWeight: 700 }}>
                  Spec Results
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {["Parameter", "Requirement", "Recorded", "By / When", "Result", ""].map((h, i) => (
                        <th key={i} style={{ textAlign: "left", padding: i === 0 ? "7px 20px" : "7px 8px", fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: colors.textFaint, fontWeight: 600 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {job.spec_results.map((r) => {
                      const superseded = !r.passed && job.spec_results.some(
                        (o) => o.param_key === r.param_key && o.passed && o.recorded_at > r.recorded_at,
                      );
                      const blocking = !r.passed && !r.resolved_at && !superseded;
                      return (
                        <tr key={r.id} style={{ borderTop: `1px solid ${colors.rowBorder}`, background: blocking ? "#FDF7F7" : "transparent" }}>
                          <td style={{ padding: "8px 20px", fontWeight: 600 }}>{r.name}</td>
                          <td style={{ padding: "8px 8px", fontFamily: fontMono, fontSize: 11, color: colors.textMuted }}>{r.requirement || "—"}</td>
                          <td style={{ padding: "8px 8px", fontFamily: fontMono, fontSize: 11 }}>{r.value_text || "—"}</td>
                          <td style={{ padding: "8px 8px", fontSize: 11, color: colors.textMuted }}>
                            {r.recorded_by} · {fmtDateTime(r.recorded_at)}
                          </td>
                          <td style={{ padding: "8px 8px" }}>
                            <Chip
                              kind={r.passed ? "good" : r.resolved_at || superseded ? "warn" : "bad"}
                              text={r.passed ? "Pass" : r.resolved_at ? "Fail — dispositioned" : superseded ? "Fail — retested" : "FAIL"}
                            />
                            {r.resolution_note ? (
                              <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 3, maxWidth: 260 }}>
                                {r.resolved_by}: {r.resolution_note}
                              </div>
                            ) : null}
                          </td>
                          <td style={{ padding: "8px 20px 8px 8px", textAlign: "right" }}>
                            {blocking && user?.role === "Quality Manager" ? (
                              resolvingId === r.id ? (
                                <span style={{ display: "inline-flex", gap: 6 }}>
                                  <input
                                    autoFocus
                                    value={resolveNote}
                                    onChange={(e) => setResolveNote(e.target.value)}
                                    placeholder="Disposition note (≥10 chars)"
                                    style={{ fontSize: 11, padding: "4px 8px", border: `1px solid ${colors.cardBorder}`, borderRadius: 4, width: 220 }}
                                  />
                                  <button
                                    onClick={() =>
                                      resolveMutation.mutate(
                                        { jobId: job.id, resultId: r.id, note: resolveNote },
                                        { onSuccess: () => { setResolvingId(null); setResolveNote(""); } },
                                      )
                                    }
                                    disabled={resolveNote.trim().length < 10 || resolveMutation.isPending}
                                    style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", background: colors.accentDefault, color: "#FFF", border: "none", borderRadius: 4, cursor: "pointer" }}
                                  >
                                    Resolve
                                  </button>
                                  <button onClick={() => setResolvingId(null)} style={{ fontSize: 11, padding: "4px 8px", background: "transparent", border: `1px solid ${colors.cardBorder}`, borderRadius: 4, cursor: "pointer" }}>
                                    ✕
                                  </button>
                                </span>
                              ) : (
                                <button
                                  onClick={() => { setResolvingId(r.id); setResolveNote(""); }}
                                  style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", background: "#FFF", color: colors.red, border: `1px solid ${colors.red}`, borderRadius: 4, cursor: "pointer" }}
                                >
                                  Disposition…
                                </button>
                              )
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}

            {job.ops.some((op) => op.recorded_parameters.length > 0) ? (
              <div style={{ borderTop: `1px solid ${colors.rowBorder}` }}>
                <div style={{ padding: "12px 20px 4px", fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", color: colors.textFaint, fontWeight: 700 }}>
                  Recorded Process Variables
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {["Op", "Parameter", "Value", "Target", "By / When", ""].map((h, i) => (
                        <th key={i} style={{ textAlign: "left", padding: i === 0 ? "7px 20px" : "7px 8px", fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: colors.textFaint, fontWeight: 600 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {job.ops.flatMap((op) =>
                      op.recorded_parameters.map((r) => (
                        <tr key={`${op.id}-${r.key}`} style={{ borderTop: `1px solid ${colors.rowBorder}`, background: r.in_spec === false ? "#FDF7F7" : "transparent" }}>
                          <td style={{ padding: "8px 20px", fontFamily: fontMono, color: colors.textFaint }}>{op.seq}</td>
                          <td style={{ padding: "8px 8px", fontWeight: 600 }}>{r.label}</td>
                          <td style={{ padding: "8px 8px", fontFamily: fontMono, fontSize: 11 }}>
                            {r.value}
                            {r.unit ? ` ${r.unit}` : ""}
                          </td>
                          <td style={{ padding: "8px 8px", fontFamily: fontMono, fontSize: 11, color: colors.textMuted }}>
                            {r.kind === "text" ? r.target_text ?? "—" : r.target_min != null || r.target_max != null ? `${r.target_min ?? ""}–${r.target_max ?? ""}` : "—"}
                          </td>
                          <td style={{ padding: "8px 8px", fontSize: 11, color: colors.textMuted }}>
                            {r.recorded_by} · {fmtDateTime(r.recorded_at)}
                          </td>
                          <td style={{ padding: "8px 20px 8px 8px" }}>
                            <Chip kind={r.in_spec === false ? "bad" : r.in_spec === true ? "good" : "neutral"} text={r.in_spec === false ? "OUT OF SPEC" : r.in_spec === true ? "In spec" : "Recorded"} />
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}

            {job.po_requirements.length > 0 || sourceDrawing ? (
              <div style={{ borderTop: `1px solid ${colors.rowBorder}` }}>
                <div style={{ padding: "12px 20px 4px", fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", color: colors.textFaint, fontWeight: 700 }}>
                  Purchase Order & Drawing Requirements
                </div>
                <RequirementsPanel poRequirements={job.po_requirements} drawing={sourceDrawing} />
              </div>
            ) : null}
          </>
        )}
      </Card>
      {showNewJob ? (
        <NewJobModal
          onClose={() => setShowNewJob(false)}
          onCreated={(newJobId) => {
            setShowNewJob(false);
            navigate(`/travelers/${newJobId}`);
          }}
        />
      ) : null}
      {showEditJob && job ? <EditJobModal job={job} onClose={() => setShowEditJob(false)} /> : null}
    </section>
  );
}

function Field({ label, value, sub, mono, color }: { label: string; value: string; sub?: string; mono: boolean; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: colors.textFaint, fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: mono ? fontMono : undefined, fontSize: 12, fontWeight: 600, marginTop: 2, color }}>{value}</div>
      {sub ? <div style={{ fontSize: 11, color: colors.textMuted }}>{sub}</div> : null}
    </div>
  );
}
