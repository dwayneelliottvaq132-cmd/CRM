import { useEffect, useRef, useState } from "react";
import { colors } from "../lib/theme";
import { useCustomers, useGenerateRoutingPlanFromDrawing, useMatchingTemplates } from "../lib/queries";
import type { DrawingAnalysis } from "../lib/types";
import { Field, FormError, Modal, PrimaryButton, SecondaryButton, Select, TextInput } from "./Modal";

/** "Populate from Drawing Scan" — used only from the Planning module (a job's drawing
 * scan, if any, is already known, so the fields are pre-filled and read-only-ish). */
export function GenerateRoutingPlanModal({
  analysis,
  onClose,
  onGenerated,
  initialCustomerId,
  initialPartNumber,
  initialRevision,
  initialSpec,
}: {
  analysis: DrawingAnalysis;
  onClose: () => void;
  onGenerated: (result: { partId: number; revisionId: number }) => void;
  initialCustomerId?: number;
  initialPartNumber?: string;
  initialRevision?: string;
  initialSpec?: string;
}) {
  const { data: customers } = useCustomers();
  const { data: matches } = useMatchingTemplates(analysis.id);
  const generate = useGenerateRoutingPlanFromDrawing();
  const [customerId, setCustomerId] = useState(initialCustomerId ? String(initialCustomerId) : "");
  const [partNumber, setPartNumber] = useState(initialPartNumber ?? analysis.part_number ?? "");
  const [revision, setRevision] = useState(initialRevision ?? analysis.revision ?? "");
  const [spec, setSpec] = useState(initialSpec ?? analysis.governing_specs?.[0]?.spec ?? "");
  const [templateId, setTemplateId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const autoSelectedRef = useRef(false);

  useEffect(() => {
    if (!autoSelectedRef.current && matches && matches.length > 0) {
      setTemplateId(matches[0].id);
      autoSelectedRef.current = true;
    }
  }, [matches]);

  async function handleSubmit() {
    setError(null);
    if (!customerId || !partNumber || !revision || !spec) {
      setError("Customer, part number, revision, and spec are all required.");
      return;
    }
    try {
      const revisionRow = await generate.mutateAsync({
        analysisId: analysis.id,
        body: { customer_id: Number(customerId), part_number: partNumber, revision, spec, attach_to_template_id: templateId || null },
      });
      onGenerated({ partId: revisionRow.part_id as number, revisionId: revisionRow.id });
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Failed to generate routing plan.");
    }
  }

  return (
    <Modal
      title="Populate from Drawing Scan"
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={handleSubmit} disabled={generate.isPending}>
            {generate.isPending ? "Generating…" : "Generate Draft Plan"}
          </PrimaryButton>
        </>
      }
    >
      <FormError message={error} />
      <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 14 }}>
        Creates a Draft routing plan from this scan's processing requirements — you'll review, assign tanks/equipment,
        and explicitly Release it before it can be applied to a job.
      </div>
      <Field label="Customer" hint="The scan can't tell us this — pick who this part belongs to">
        <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Select customer…</option>
          {(customers ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <Field label="Part Number">
          <TextInput value={partNumber} onChange={(e) => setPartNumber(e.target.value)} placeholder="10847-3" />
        </Field>
        <Field label="Revision">
          <TextInput value={revision} onChange={(e) => setRevision(e.target.value)} placeholder="A" />
        </Field>
      </div>
      <Field label="Governing Spec">
        <TextInput value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="MIL-A-8625 Type II Class 1" />
      </Field>
      <Field
        label="Attach to Routing Template"
        hint={
          matches && matches.length > 0
            ? "Clone this spec's generic template and layer this drawing's masking/post-treatment on top of it, instead of building steps from scratch."
            : "No released template matches this spec yet — steps will be built from scratch from what the scan found."
        }
      >
        <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)} disabled={!matches || matches.length === 0}>
          <option value="">Build from scratch (no template)</option>
          {(matches ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.id} — {t.name} ({t.spec})
            </option>
          ))}
        </Select>
      </Field>
    </Modal>
  );
}
