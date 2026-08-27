import { useEffect, useState } from "react";
import { colors } from "../lib/theme";
import { useAcceptContractReview, usePoAnalysis, useRejectContractReview, useSaveContractReview } from "../lib/queries";
import * as api from "../api/endpoints";
import { Field, FormError, Modal, PrimaryButton, SecondaryButton, TextInput } from "./Modal";
import type { ContractReview, Order } from "../lib/types";

const CHECKLIST: { key: keyof ContractReview; label: string }[] = [
  { key: "customer_requirements_reviewed", label: "Customer requirements reviewed (delivery, packaging, marking, C of C)" },
  { key: "spec_and_revision_confirmed", label: "Governing spec and revision confirmed against the order/print" },
  { key: "special_requirements_understood", label: "Special requirements understood (source inspection, FAI, key characteristics)" },
  { key: "regulatory_itar_reviewed", label: "Statutory / regulatory / ITAR requirements reviewed" },
  { key: "approved_process_available", label: "An approved process / routing plan is available (or planned)" },
  { key: "capacity_confirmed", label: "Capacity and on-time delivery capability confirmed" },
  { key: "differences_resolved", label: "Any differences from the quote / prior order resolved" },
];

export function ContractReviewModal({ order, onClose, onAccepted }: { order: Order; onClose: () => void; onAccepted: (jobId: string) => void }) {
  const save = useSaveContractReview();
  const accept = useAcceptContractReview();
  const reject = useRejectContractReview();
  const { data: linkedPo } = usePoAnalysis(order.purchase_order_analysis_id ?? undefined);
  const [review, setReview] = useState<ContractReview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getContractReview(order.id).then(setReview).catch(() => setError("Could not load the contract review."));
  }, [order.id]);

  function set(key: keyof ContractReview, value: boolean | string) {
    setReview((r) => (r ? { ...r, [key]: value } : r));
  }

  const allChecked = review ? CHECKLIST.every((c) => review[c.key]) : false;
  const accepted = review?.outcome === "Accepted";

  async function handleAccept() {
    if (!review) return;
    setError(null);
    try {
      await save.mutateAsync({
        orderId: order.id,
        body: {
          customer_requirements_reviewed: review.customer_requirements_reviewed,
          spec_and_revision_confirmed: review.spec_and_revision_confirmed,
          special_requirements_understood: review.special_requirements_understood,
          regulatory_itar_reviewed: review.regulatory_itar_reviewed,
          approved_process_available: review.approved_process_available,
          capacity_confirmed: review.capacity_confirmed,
          differences_resolved: review.differences_resolved,
          governing_spec: review.governing_spec,
          spec_revision: review.spec_revision,
          notes: review.notes,
        },
      });
      const job = await accept.mutateAsync(order.id);
      onAccepted(job.id);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Could not accept the contract review.");
    }
  }

  return (
    <Modal
      title={`Contract Review — ${order.id}`}
      onClose={onClose}
      width={620}
      footer={
        accepted ? (
          <SecondaryButton onClick={onClose}>Close</SecondaryButton>
        ) : (
          <>
            <SecondaryButton onClick={() => reject.mutate(order.id, { onSuccess: onClose })}>Reject</SecondaryButton>
            <PrimaryButton onClick={handleAccept} disabled={!allChecked || save.isPending || accept.isPending}>
              {accept.isPending ? "Accepting…" : "Accept & Create Work Order"}
            </PrimaryButton>
          </>
        )
      }
    >
      <FormError message={error} />
      <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 12 }}>
        {order.customer.name}
        {order.customer.quality_standards ? ` · ${order.customer.quality_standards}` : ""} — AS9100 §8.2.3 requires this review
        before the order can become a work order. All items must be confirmed to accept.
      </div>
      {!review ? (
        <div style={{ fontSize: 12, color: colors.textMuted }}>Loading…</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 12 }}>
            <Field label="Governing Spec">
              <TextInput value={review.governing_spec} disabled={accepted} onChange={(e) => set("governing_spec", e.target.value)} />
            </Field>
            <Field label="Revision">
              <TextInput value={review.spec_revision} disabled={accepted} onChange={(e) => set("spec_revision", e.target.value)} placeholder="Rev" />
            </Field>
          </div>
          {(review.captured_requirements ?? []).length > 0 ? (
            <div style={{ marginBottom: 12, padding: "8px 12px", background: "#FFF8EC", border: "1px solid #E3C888", borderRadius: 6 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#8A6D1D", fontWeight: 700, marginBottom: 4 }}>
                Special requirements from the purchase order
              </div>
              {(review.captured_requirements ?? []).map((r, i) => (
                <div key={i} style={{ fontSize: 12, color: "#6B5314" }}>• {r}</div>
              ))}
            </div>
          ) : null}
          {order.purchase_order_analysis_id ? (
            <div style={{ fontSize: 11, color: colors.textFaint, marginBottom: 10 }}>
              Linked scanned purchase order #{order.purchase_order_analysis_id} on file for reference.
              {linkedPo?.stored_file_path ? (
                <>
                  {" "}
                  <a href={api.poFileUrl(linkedPo.id)} target="_blank" rel="noreferrer" style={{ color: colors.accentDefault, fontWeight: 600 }}>
                    View PO PDF ↗
                  </a>
                </>
              ) : null}
              {(linkedPo?.matched_drawings ?? []).filter((d) => d.stored_file_path).map((d) => (
                <span key={d.id}>
                  {" · "}
                  <a href={api.drawingFileUrl(d.id)} target="_blank" rel="noreferrer" style={{ color: colors.accentDefault, fontWeight: 600 }}>
                    View drawing {d.part_number ?? d.filename} ↗
                  </a>
                </span>
              ))}
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 8 }}>
            {CHECKLIST.map((c) => (
              <label key={c.key} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={Boolean(review[c.key])}
                  disabled={accepted}
                  onChange={(e) => set(c.key, e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                {c.label}
              </label>
            ))}
          </div>
          <Field label="Reviewer notes">
            <TextInput value={review.notes} disabled={accepted} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" />
          </Field>
          {accepted ? (
            <div style={{ fontSize: 11, color: colors.green, fontWeight: 600 }}>
              ✓ Accepted by {review.reviewed_by} — work order(s) created.
            </div>
          ) : null}
        </>
      )}
    </Modal>
  );
}
