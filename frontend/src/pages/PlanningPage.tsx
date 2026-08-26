import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { colors, fontMono, routingStatusKind } from "../lib/theme";
import { fmtDate, fmtDateTime } from "../lib/format";
import {
  useApplyPlaceholderPlan,
  useApplyReleasedPlan,
  useArchivePart,
  useArchiveRoutingTemplate,
  useCreatePart,
  useCreatePartRevision,
  useCreateRoutingTemplate,
  useCreateTemplateRevision,
  useCustomers,
  useObsoleteRevision,
  useParts,
  usePartRevisions,
  usePlanningContext,
  usePlanningQueue,
  useReleaseRevision,
  useReplaceRevisionSteps,
  useRoutingRevision,
  useRoutingTemplates,
  useTemplateRevisions,
  useUpdatePart,
  useUpdateRoutingTemplate,
} from "../lib/queries";
import * as api from "../api/endpoints";
import { Card } from "../components/Table";
import { Chip } from "../components/Chip";
import { Field, FormError, Modal, PrimaryButton, SecondaryButton, Select, TextInput } from "../components/Modal";
import { RoutingStepEditor, type EditableStep } from "../components/RoutingStepEditor";
import { RequirementsPanel } from "../components/RequirementsPanel";
import { GenerateRoutingPlanModal } from "../components/GenerateRoutingPlanModal";
import { GenerateFromPoModal } from "../components/GenerateFromPoModal";
import { AttachmentGallery } from "../components/AttachmentGallery";
import type { Part, RoutingRevision, RoutingTemplate } from "../lib/types";

type Selected = { kind: "template"; id: string } | { kind: "part"; id: number } | null;
type Tab = "queue" | "library";

function TemplateModal({ initial, onClose }: { initial?: RoutingTemplate; onClose: () => void }) {
  const createTemplate = useCreateRoutingTemplate();
  const updateTemplate = useUpdateRoutingTemplate();
  const [name, setName] = useState(initial?.name ?? "");
  const [spec, setSpec] = useState(initial?.spec ?? "");
  const [error, setError] = useState<string | null>(null);
  const busy = createTemplate.isPending || updateTemplate.isPending;

  async function handleSubmit() {
    setError(null);
    if (!name || !spec) {
      setError("Name and spec are required.");
      return;
    }
    try {
      if (initial) {
        await updateTemplate.mutateAsync({ id: initial.id, body: { name, spec } });
      } else {
        await createTemplate.mutateAsync({ name, spec });
      }
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Failed to save template.");
    }
  }

  return (
    <Modal
      title={initial ? `Edit ${initial.id}` : "New Routing Template"}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={handleSubmit} disabled={busy}>
            {busy ? "Saving…" : initial ? "Save Changes" : "Create"}
          </PrimaryButton>
        </>
      }
    >
      <FormError message={error} />
      <Field label="Name">
        <TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Type II Class 1 Anodize — Standard" />
      </Field>
      <Field label="Governing Spec">
        <TextInput value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="MIL-A-8625 Type II Class 1" />
      </Field>
    </Modal>
  );
}

function PartModal({ initial, onClose }: { initial?: Part; onClose: () => void }) {
  const { data: customers } = useCustomers();
  const createPart = useCreatePart();
  const updatePart = useUpdatePart();
  const [customerId, setCustomerId] = useState(initial ? String(initial.customer_id) : "");
  const [partNumber, setPartNumber] = useState(initial?.part_number ?? "");
  const [revision, setRevision] = useState(initial?.revision ?? "A");
  const [spec, setSpec] = useState(initial?.spec ?? "");
  const [itar, setItar] = useState(initial?.itar ?? false);
  const [error, setError] = useState<string | null>(null);
  const busy = createPart.isPending || updatePart.isPending;

  async function handleSubmit() {
    setError(null);
    if (initial) {
      try {
        await updatePart.mutateAsync({ id: initial.id, body: { spec, itar } });
        onClose();
      } catch (err: unknown) {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(detail ?? "Failed to save part.");
      }
      return;
    }
    if (!customerId || !partNumber || !revision || !spec) {
      setError("All fields are required.");
      return;
    }
    try {
      await createPart.mutateAsync({ customer_id: Number(customerId), part_number: partNumber, revision, spec, itar });
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Failed to create part.");
    }
  }

  return (
    <Modal
      title={initial ? `Edit ${initial.part_number} Rev ${initial.revision}` : "New Part"}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={handleSubmit} disabled={busy}>
            {busy ? "Saving…" : initial ? "Save Changes" : "Create"}
          </PrimaryButton>
        </>
      }
    >
      <FormError message={error} />
      <Field label="Customer" hint={initial ? "Customer can't be changed after creation" : undefined}>
        {initial ? (
          <TextInput value={customers?.find((c) => c.id === initial.customer_id)?.name ?? ""} disabled />
        ) : (
          <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Select customer…</option>
            {(customers ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <Field label="Part Number" hint={initial ? "Can't be changed after creation" : undefined}>
          <TextInput value={partNumber} onChange={(e) => setPartNumber(e.target.value)} disabled={!!initial} placeholder="10847-3" />
        </Field>
        <Field label="Revision" hint={initial ? "Can't be changed after creation" : undefined}>
          <TextInput value={revision} onChange={(e) => setRevision(e.target.value)} disabled={!!initial} />
        </Field>
      </div>
      <Field label="Governing Spec">
        <TextInput value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="MIL-A-8625 Type II Class 1" />
      </Field>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginTop: 4 }}>
        <input type="checkbox" checked={itar} onChange={(e) => setItar(e.target.checked)} />
        ITAR registered
      </label>
    </Modal>
  );
}

function NewPartRevisionModal({ partId, onClose }: { partId: number; onClose: () => void }) {
  const { data: templates } = useRoutingTemplates();
  const createRevision = useCreatePartRevision();
  const [templateId, setTemplateId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    setError(null);
    setBusy(true);
    try {
      let cloneFromRevisionId: number | null = null;
      if (templateId) {
        const revisions = await api.listTemplateRevisions(templateId);
        const released = revisions.find((r) => r.status === "Released");
        if (!released) {
          setError("That template has no Released revision to clone from.");
          setBusy(false);
          return;
        }
        cloneFromRevisionId = released.id;
      }
      await createRevision.mutateAsync({ partId, body: { clone_from_revision_id: cloneFromRevisionId } });
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Failed to create revision.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="New Part Revision"
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={handleSubmit} disabled={busy}>
            {busy ? "Creating…" : "Create Draft"}
          </PrimaryButton>
        </>
      }
    >
      <FormError message={error} />
      <Field label="Start From" hint="Clones the template's currently Released revision as a starting point — or leave blank to build from scratch">
        <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          <option value="">Blank draft</option>
          {(templates ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.id} — {t.name}
            </option>
          ))}
        </Select>
      </Field>
    </Modal>
  );
}

function RevisionList({
  revisions,
  selectedId,
  onSelect,
}: {
  revisions: RoutingRevision[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  if (revisions.length === 0) return <div style={{ padding: "12px 16px", fontSize: 12, color: colors.textFaint }}>No revisions yet.</div>;
  return (
    <div>
      {revisions.map((r) => (
        <div
          key={r.id}
          onClick={() => onSelect(r.id)}
          className="row-hover"
          style={{
            padding: "8px 16px",
            borderTop: `1px solid ${colors.rowBorder}`,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: r.id === selectedId ? "#F0F5F8" : "transparent",
          }}
        >
          <span style={{ fontFamily: fontMono, fontSize: 12, fontWeight: 600 }}>Rev {r.revision_number}</span>
          <Chip kind={routingStatusKind(r.status)} text={r.status} />
          <span style={{ marginLeft: "auto", fontSize: 11, color: colors.textFaint }}>
            {r.released_at ? `Released ${fmtDateTime(r.released_at)}` : `Created ${fmtDateTime(r.created_at)}`}
          </span>
        </div>
      ))}
    </div>
  );
}

function RevisionDetail({
  revisionId,
  templateId,
  partId,
}: {
  revisionId: number;
  templateId?: string;
  partId?: number;
}) {
  const { data: revision } = useRoutingRevision(revisionId);
  const replaceSteps = useReplaceRevisionSteps();
  const releaseRevision = useReleaseRevision();
  const obsoleteRevision = useObsoleteRevision();
  const [steps, setSteps] = useState<EditableStep[]>([]);
  const [dirty, setDirty] = useState(false);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [confirmObsolete, setConfirmObsolete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (revision) {
      setSteps(revision.steps.map((s) => ({ ...s })));
      setDirty(false);
    }
  }, [revision]);

  if (!revision) return null;
  const isDraft = revision.status === "Draft";

  async function handleSaveSteps() {
    setError(null);
    try {
      await replaceSteps.mutateAsync({ revisionId, steps });
      setDirty(false);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Failed to save steps.");
    }
  }

  async function handleRelease() {
    setError(null);
    try {
      await releaseRevision.mutateAsync({ revisionId, templateId, partId });
      setConfirmRelease(false);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Failed to release.");
    }
  }

  async function handleObsolete() {
    setError(null);
    try {
      await obsoleteRevision.mutateAsync({ revisionId, templateId, partId });
      setConfirmObsolete(false);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Failed to obsolete.");
    }
  }

  return (
    <div style={{ padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Revision {revision.revision_number}</span>
        <Chip kind={routingStatusKind(revision.status)} text={revision.status} />
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {isDraft && dirty ? (
            <PrimaryButton onClick={handleSaveSteps} disabled={replaceSteps.isPending}>
              {replaceSteps.isPending ? "Saving…" : "Save Steps"}
            </PrimaryButton>
          ) : null}
          {isDraft ? (
            confirmRelease ? (
              <>
                <PrimaryButton onClick={handleRelease} disabled={releaseRevision.isPending}>
                  {releaseRevision.isPending ? "Releasing…" : "Confirm Release"}
                </PrimaryButton>
                <SecondaryButton onClick={() => setConfirmRelease(false)}>✕</SecondaryButton>
              </>
            ) : (
              <SecondaryButton onClick={() => setConfirmRelease(true)}>Release</SecondaryButton>
            )
          ) : revision.status !== "Obsolete" ? (
            confirmObsolete ? (
              <>
                <SecondaryButton onClick={handleObsolete} style={{ color: colors.red, borderColor: colors.red }}>
                  {obsoleteRevision.isPending ? "…" : "Confirm Obsolete"}
                </SecondaryButton>
                <SecondaryButton onClick={() => setConfirmObsolete(false)}>✕</SecondaryButton>
              </>
            ) : (
              <SecondaryButton onClick={() => setConfirmObsolete(true)} style={{ color: colors.red, borderColor: colors.red }}>
                Obsolete
              </SecondaryButton>
            )
          ) : null}
        </div>
      </div>
      <FormError message={error} />
      <RoutingStepEditor
        steps={steps}
        readOnly={!isDraft}
        onChange={(next) => {
          setSteps(next);
          setDirty(true);
        }}
      />
    </div>
  );
}

function NeedsPlanningTab() {
  const navigate = useNavigate();
  const { data: queue, isLoading } = usePlanningQueue();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedRevisionId, setSelectedRevisionId] = useState<number | null>(null);
  const [showGenerateFromDrawing, setShowGenerateFromDrawing] = useState(false);
  const [showGenerateFromPo, setShowGenerateFromPo] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const effectiveJobId = selectedJobId ?? queue?.[0]?.id;
  const { data: context } = usePlanningContext(effectiveJobId);
  const { data: partRevisions } = usePartRevisions(context?.part.id);
  const applyReleased = useApplyReleasedPlan();
  const applyPlaceholder = useApplyPlaceholderPlan();

  useEffect(() => {
    setSelectedRevisionId(null);
    setActionError(null);
    setSuccessMsg(null);
  }, [effectiveJobId]);

  const hasReleasedPlan = (partRevisions ?? []).some((r) => r.status === "Released");
  const requiresApproved = context?.job.customer.require_approved_routing ?? false;
  const hasPoProcessing = (context?.po_line?.processing_requirements ?? []).length > 0;

  async function handleApplyReleased() {
    if (!effectiveJobId) return;
    setActionError(null);
    try {
      await applyReleased.mutateAsync(effectiveJobId);
      setSuccessMsg("Released plan applied — traveler ready.");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setActionError(detail ?? "Failed to apply the released plan.");
    }
  }

  async function handleApplyPlaceholder() {
    if (!effectiveJobId) return;
    setActionError(null);
    try {
      await applyPlaceholder.mutateAsync(effectiveJobId);
      setSuccessMsg("Proceeding without a formal plan — traveler ready with a default step.");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setActionError(detail ?? "Failed to proceed without a plan.");
    }
  }

  return (
    <section style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, alignItems: "start" }}>
      <Card>
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${colors.rowBorder}`, fontSize: 13, fontWeight: 700 }}>
          Jobs Needing Planning
        </div>
        {isLoading ? (
          <div style={{ padding: 16, fontSize: 12 }}>Loading…</div>
        ) : (queue ?? []).length === 0 ? (
          <div style={{ padding: 16, fontSize: 12, color: colors.textFaint }}>Nothing waiting — every job has a plan.</div>
        ) : (
          (queue ?? []).map((j) => (
            <div
              key={j.id}
              onClick={() => setSelectedJobId(j.id)}
              className="row-hover"
              style={{
                padding: "10px 14px",
                borderTop: `1px solid ${colors.rowBorder}`,
                cursor: "pointer",
                background: j.id === effectiveJobId ? "#F0F5F8" : "transparent",
                borderLeft: `3px solid ${j.id === effectiveJobId ? colors.accentDefault : "transparent"}`,
              }}
            >
              <div style={{ fontFamily: fontMono, fontSize: 12, fontWeight: 600, color: colors.accentDefault }}>{j.id}</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{j.customer.name}</div>
              <div style={{ fontSize: 11, color: colors.textMuted }}>
                {j.part_number} Rev {j.revision} · {j.spec}
              </div>
              <div style={{ fontSize: 10, color: colors.textFaint, marginTop: 2 }}>
                Due {fmtDate(j.due_date)}
                {j.source_drawing_analysis_id ? " · has drawing scan" : ""}
                {j.po_requirements.length > 0 ? " · has PO requirements" : ""}
              </div>
            </div>
          ))
        )}
      </Card>

      <Card>
        {!context ? (
          <div style={{ padding: 24, fontSize: 12, color: colors.textFaint }}>Select a job from the queue.</div>
        ) : (
          <>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${colors.rowBorder}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: fontMono, fontSize: 17, fontWeight: 700 }}>{context.job.id}</span>
                <Chip kind="warn" text="Needs Planning" />
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  {context.drawing ? (
                    <SecondaryButton onClick={() => setShowGenerateFromDrawing(true)}>Populate from Drawing Scan</SecondaryButton>
                  ) : null}
                  {hasPoProcessing ? (
                    <SecondaryButton onClick={() => setShowGenerateFromPo(true)}>Populate from PO Scan</SecondaryButton>
                  ) : null}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 14 }}>
                <div>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: colors.textFaint, fontWeight: 600 }}>Customer / PO</div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{context.job.customer.name}</div>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>{context.job.customer_po}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: colors.textFaint, fontWeight: 600 }}>Part / Rev</div>
                  <div style={{ fontFamily: fontMono, fontSize: 12, fontWeight: 600, marginTop: 2 }}>{context.job.part_number} Rev {context.job.revision}</div>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>Qty {context.job.qty}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: colors.textFaint, fontWeight: 600 }}>Governing Spec</div>
                  <div style={{ fontFamily: fontMono, fontSize: 12, fontWeight: 600, marginTop: 2, color: colors.accentDefault }}>{context.job.spec}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: colors.textFaint, fontWeight: 600 }}>Due Date</div>
                  <div style={{ fontFamily: fontMono, fontSize: 12, fontWeight: 600, marginTop: 2 }}>{fmtDate(context.job.due_date)}</div>
                </div>
              </div>
              {requiresApproved ? (
                <div style={{ marginTop: 12, fontSize: 11, color: "#8A6D1D" }}>
                  ⚠ {context.job.customer.name} requires an approved routing plan — "Proceed Without a Formal Plan" is disabled for this job.
                </div>
              ) : null}
              {context.spec_mismatch ? (
                <div
                  style={{
                    marginTop: 12, background: "#FBEFEF", border: `1px solid ${colors.red}`, borderRadius: 6,
                    padding: "8px 12px", fontSize: 11, color: colors.red, fontWeight: 600,
                  }}
                >
                  ⚠ Spec mismatch: {context.spec_mismatch}
                </div>
              ) : null}
            </div>

            <RequirementsPanel poRequirements={context.job.po_requirements} drawing={context.drawing} />

            <div style={{ borderTop: `1px solid ${colors.rowBorder}` }}>
              <div style={{ padding: "12px 20px 6px", fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", color: colors.textFaint, fontWeight: 700 }}>
                Part {context.part.part_number} Rev {context.part.revision} — Revisions
              </div>
              <RevisionList revisions={partRevisions ?? []} selectedId={selectedRevisionId} onSelect={setSelectedRevisionId} />
              {selectedRevisionId ? (
                <div style={{ borderTop: `1px solid ${colors.rowBorder}` }}>
                  <RevisionDetail revisionId={selectedRevisionId} partId={context.part.id} />
                </div>
              ) : null}
            </div>

            <div style={{ borderTop: `1px solid ${colors.rowBorder}`, padding: "14px 20px" }}>
              {actionError ? (
                <div style={{ marginBottom: 10, background: "#FBEFEF", border: `1px solid ${colors.red}`, borderRadius: 6, padding: "8px 12px", fontSize: 11, color: colors.red }}>
                  {actionError}
                </div>
              ) : null}
              {successMsg ? (
                <div style={{ marginBottom: 10, background: "#EFF7EE", border: `1px solid ${colors.green}`, borderRadius: 6, padding: "8px 12px", fontSize: 12, color: colors.green, fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>
                  ✓ {successMsg}
                  <a
                    href={`/travelers/${context.job.id}`}
                    onClick={(e) => { e.preventDefault(); navigate(`/travelers/${context.job.id}`); }}
                    style={{ marginLeft: "auto", color: colors.accentDefault, fontWeight: 700 }}
                  >
                    Open Traveler →
                  </a>
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 10 }}>
                <PrimaryButton onClick={handleApplyReleased} disabled={!hasReleasedPlan || applyReleased.isPending}>
                  {applyReleased.isPending ? "Applying…" : "Apply Released Plan"}
                </PrimaryButton>
                <SecondaryButton onClick={handleApplyPlaceholder} disabled={requiresApproved || applyPlaceholder.isPending}>
                  {applyPlaceholder.isPending ? "Proceeding…" : "Proceed Without a Formal Plan"}
                </SecondaryButton>
              </div>
              {!hasReleasedPlan ? (
                <div style={{ fontSize: 10, color: colors.textFaint, marginTop: 6 }}>
                  No Released plan yet for this part — release one above, or populate a draft from the drawing/PO scan.
                </div>
              ) : null}
            </div>
          </>
        )}
      </Card>

      {showGenerateFromDrawing && context?.drawing ? (
        <GenerateRoutingPlanModal
          analysis={context.drawing}
          initialCustomerId={context.job.customer.id}
          initialPartNumber={context.job.part_number}
          initialRevision={context.job.revision}
          initialSpec={context.job.spec}
          onClose={() => setShowGenerateFromDrawing(false)}
          onGenerated={({ revisionId }) => {
            setShowGenerateFromDrawing(false);
            setSelectedRevisionId(revisionId);
          }}
        />
      ) : null}
      {showGenerateFromPo && context && effectiveJobId ? (
        <GenerateFromPoModal
          jobId={effectiveJobId}
          matchingTemplates={context.matching_templates}
          drawing={context.drawing}
          onClose={() => setShowGenerateFromPo(false)}
          onGenerated={({ revisionId }) => {
            setShowGenerateFromPo(false);
            setSelectedRevisionId(revisionId);
          }}
        />
      ) : null}
    </section>
  );
}

function LibraryTab() {
  const { data: templates, isLoading: templatesLoading } = useRoutingTemplates();
  const { data: parts, isLoading: partsLoading } = useParts();
  const archiveTemplate = useArchiveRoutingTemplate();
  const archivePart = useArchivePart();
  const createTemplateRevision = useCreateTemplateRevision();

  const [selected, setSelected] = useState<Selected>(null);
  const [selectedRevisionId, setSelectedRevisionId] = useState<number | null>(null);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [showNewPart, setShowNewPart] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RoutingTemplate | null>(null);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [showNewPartRevision, setShowNewPartRevision] = useState(false);

  const { data: templateRevisions } = useTemplateRevisions(selected?.kind === "template" ? selected.id : undefined);
  const { data: partRevisions } = usePartRevisions(selected?.kind === "part" ? selected.id : undefined);

  const selectedTemplate = selected?.kind === "template" ? templates?.find((t) => t.id === selected.id) : undefined;
  const selectedPart = selected?.kind === "part" ? parts?.find((p) => p.id === selected.id) : undefined;

  async function handleNewTemplateRevision() {
    if (selected?.kind !== "template") return;
    const revision = await createTemplateRevision.mutateAsync({ templateId: selected.id, body: {} });
    setSelectedRevisionId(revision.id);
  }

  return (
    <section style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${colors.rowBorder}`, display: "flex", alignItems: "center", fontSize: 13, fontWeight: 700 }}>
            Routing Templates
            <button
              onClick={() => setShowNewTemplate(true)}
              style={{ marginLeft: "auto", background: colors.accentDefault, color: "#FFFFFF", border: "none", borderRadius: 4, padding: "4px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
            >
              + New
            </button>
          </div>
          {templatesLoading ? (
            <div style={{ padding: 16, fontSize: 12 }}>Loading…</div>
          ) : (
            (templates ?? []).map((t) => (
              <div
                key={t.id}
                onClick={() => {
                  setSelected({ kind: "template", id: t.id });
                  setSelectedRevisionId(null);
                }}
                className="row-hover"
                style={{
                  padding: "10px 14px",
                  borderTop: `1px solid ${colors.rowBorder}`,
                  cursor: "pointer",
                  background: selected?.kind === "template" && selected.id === t.id ? "#F0F5F8" : "transparent",
                  borderLeft: `3px solid ${selected?.kind === "template" && selected.id === t.id ? colors.accentDefault : "transparent"}`,
                }}
              >
                <div style={{ fontFamily: fontMono, fontSize: 12, fontWeight: 600, color: colors.accentDefault }}>{t.id}</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{t.name}</div>
                <div style={{ fontSize: 11, color: colors.textMuted }}>{t.spec}</div>
              </div>
            ))
          )}
        </Card>

        <Card>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${colors.rowBorder}`, display: "flex", alignItems: "center", fontSize: 13, fontWeight: 700 }}>
            Parts
            <button
              onClick={() => setShowNewPart(true)}
              style={{ marginLeft: "auto", background: colors.accentDefault, color: "#FFFFFF", border: "none", borderRadius: 4, padding: "4px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
            >
              + New
            </button>
          </div>
          {partsLoading ? (
            <div style={{ padding: 16, fontSize: 12 }}>Loading…</div>
          ) : (
            (parts ?? []).map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  setSelected({ kind: "part", id: p.id });
                  setSelectedRevisionId(null);
                }}
                className="row-hover"
                style={{
                  padding: "10px 14px",
                  borderTop: `1px solid ${colors.rowBorder}`,
                  cursor: "pointer",
                  background: selected?.kind === "part" && selected.id === p.id ? "#F0F5F8" : "transparent",
                  borderLeft: `3px solid ${selected?.kind === "part" && selected.id === p.id ? colors.accentDefault : "transparent"}`,
                }}
              >
                <div style={{ fontFamily: fontMono, fontSize: 12, fontWeight: 600 }}>
                  {p.part_number} <span style={{ color: colors.textFaint }}>Rev {p.revision}</span>
                </div>
                <div style={{ fontSize: 11, color: colors.textMuted }}>{p.spec}</div>
              </div>
            ))
          )}
        </Card>
      </div>

      <Card>
        {selected?.kind === "template" && selectedTemplate ? (
          <>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${colors.rowBorder}`, display: "flex", alignItems: "center", gap: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedTemplate.name}</div>
                <div style={{ fontSize: 11, color: colors.textMuted, fontFamily: fontMono }}>{selectedTemplate.id} · {selectedTemplate.spec}</div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <SecondaryButton onClick={() => setEditingTemplate(selectedTemplate)}>Edit</SecondaryButton>
                <SecondaryButton onClick={() => archiveTemplate.mutate(selectedTemplate.id)} style={{ color: colors.red, borderColor: colors.red }}>
                  Archive
                </SecondaryButton>
                <PrimaryButton onClick={handleNewTemplateRevision} disabled={createTemplateRevision.isPending}>
                  + New Revision
                </PrimaryButton>
              </div>
            </div>
            <RevisionList revisions={templateRevisions ?? []} selectedId={selectedRevisionId} onSelect={setSelectedRevisionId} />
            {selectedRevisionId ? (
              <div style={{ borderTop: `1px solid ${colors.rowBorder}` }}>
                <RevisionDetail revisionId={selectedRevisionId} templateId={selectedTemplate.id} />
              </div>
            ) : null}
          </>
        ) : selected?.kind === "part" && selectedPart ? (
          <>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${colors.rowBorder}`, display: "flex", alignItems: "center", gap: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: fontMono }}>
                  {selectedPart.part_number} Rev {selectedPart.revision}
                </div>
                <div style={{ fontSize: 11, color: colors.textMuted }}>{selectedPart.spec}</div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <SecondaryButton onClick={() => setEditingPart(selectedPart)}>Edit</SecondaryButton>
                <SecondaryButton onClick={() => archivePart.mutate(selectedPart.id)} style={{ color: colors.red, borderColor: colors.red }}>
                  Archive
                </SecondaryButton>
                <PrimaryButton onClick={() => setShowNewPartRevision(true)}>+ New Revision</PrimaryButton>
              </div>
            </div>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${colors.rowBorder}` }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: colors.textFaint, fontWeight: 700, marginBottom: 8 }}>
                Part Photos
              </div>
              <AttachmentGallery entityType="part" entityId={selectedPart.id} emptyText="No photos of this part yet." />
            </div>
            <RevisionList revisions={partRevisions ?? []} selectedId={selectedRevisionId} onSelect={setSelectedRevisionId} />
            {selectedRevisionId ? (
              <div style={{ borderTop: `1px solid ${colors.rowBorder}` }}>
                <RevisionDetail revisionId={selectedRevisionId} partId={selectedPart.id} />
              </div>
            ) : null}
          </>
        ) : (
          <div style={{ padding: 24, fontSize: 12, color: colors.textFaint }}>Select a routing template or part from the left, or create a new one.</div>
        )}
      </Card>

      {showNewTemplate ? <TemplateModal onClose={() => setShowNewTemplate(false)} /> : null}
      {editingTemplate ? <TemplateModal initial={editingTemplate} onClose={() => setEditingTemplate(null)} /> : null}
      {showNewPart ? <PartModal onClose={() => setShowNewPart(false)} /> : null}
      {editingPart ? <PartModal initial={editingPart} onClose={() => setEditingPart(null)} /> : null}
      {showNewPartRevision && selected?.kind === "part" ? (
        <NewPartRevisionModal partId={selected.id} onClose={() => setShowNewPartRevision(false)} />
      ) : null}
    </section>
  );
}

export function PlanningPage() {
  const [tab, setTab] = useState<Tab>("queue");
  const { data: queue } = usePlanningQueue();

  return (
    <section>
      <div style={{ display: "flex", gap: 8, marginBottom: 18, borderBottom: `1px solid ${colors.rowBorder}` }}>
        {([
          ["queue", `Needs Planning${queue && queue.length > 0 ? ` (${queue.length})` : ""}`],
          ["library", "Templates & Parts Library"],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: 600,
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${tab === key ? colors.accentDefault : "transparent"}`,
              color: tab === key ? colors.accentDefault : colors.textMuted,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "queue" ? <NeedsPlanningTab /> : <LibraryTab />}
    </section>
  );
}
