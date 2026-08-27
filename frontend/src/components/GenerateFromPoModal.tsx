import { useEffect, useRef, useState } from "react";
import { colors } from "../lib/theme";
import { useGenerateFromPo } from "../lib/queries";
import type { DrawingAnalysis, RoutingTemplate } from "../lib/types";
import { Field, FormError, Modal, PrimaryButton, SecondaryButton, Select } from "./Modal";

/** "Populate from PO Scan" — the PO-side counterpart to GenerateRoutingPlanModal.
 * Customer/part/revision/spec all come from the job itself (no override fields needed,
 * unlike the drawing flow where the scan might not have found a part number) — this
 * modal is just the template-match review + confirm step. */
export function GenerateFromPoModal({
  jobId,
  matchingTemplates,
  drawing,
  onClose,
  onGenerated,
}: {
  jobId: string;
  matchingTemplates: RoutingTemplate[];
  drawing: DrawingAnalysis | null | undefined;
  onClose: () => void;
  onGenerated: (result: { revisionId: number }) => void;
}) {
  const generate = useGenerateFromPo();
  const [templateId, setTemplateId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const autoSelectedRef = useRef(false);

  useEffect(() => {
    if (!autoSelectedRef.current && matchingTemplates.length > 0) {
      setTemplateId(matchingTemplates[0].id);
      autoSelectedRef.current = true;
    }
  }, [matchingTemplates]);

  async function handleSubmit() {
    setError(null);
    try {
      const revision = await generate.mutateAsync({ jobId, attachToTemplateId: templateId || null });
      onGenerated({ revisionId: revision.id });
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Failed to generate routing plan.");
    }
  }

  return (
    <Modal
      title="Populate from PO Scan"
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
        Creates a Draft routing plan from this PO line's processing requirements — you'll review, assign tanks/equipment,
        and explicitly Release it before it can be applied to a job.
        {drawing ? " This job also has a linked drawing scan — its masking/post-treatment requirements are layered in either way." : ""}
      </div>
      <Field
        label="Attach to Routing Template"
        hint={
          matchingTemplates.length > 0
            ? "Clone this spec's generic template and layer masking/post-treatment on top of it, instead of building steps from scratch."
            : "No released template matches this PO line's spec yet — steps will be built from scratch from what the scan found."
        }
      >
        <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)} disabled={matchingTemplates.length === 0}>
          <option value="">Build from scratch (no template)</option>
          {matchingTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.id} — {t.name} ({t.spec})
            </option>
          ))}
        </Select>
      </Field>
    </Modal>
  );
}
