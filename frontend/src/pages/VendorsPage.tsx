import { useState } from "react";
import { colors, fontMono, statusKind } from "../lib/theme";
import { fmtDate } from "../lib/format";
import { useArchiveVendor, useCreateVendor, useUpdateVendor, useVendors } from "../lib/queries";
import { Card, Table, type Column } from "../components/Table";
import { Chip } from "../components/Chip";
import { Field, FormError, Modal, PrimaryButton, SecondaryButton, Select, TextInput } from "../components/Modal";
import type { Vendor } from "../lib/types";

function VendorModal({ initial, onClose }: { initial?: Vendor; onClose: () => void }) {
  const createVendor = useCreateVendor();
  const updateVendor = useUpdateVendor();
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [approvalBasis, setApprovalBasis] = useState(initial?.approval_basis ?? "");
  const [otdPct, setOtdPct] = useState(String(initial?.otd_pct ?? 100));
  const [status, setStatus] = useState(initial?.status ?? "Approved");
  const [error, setError] = useState<string | null>(null);

  const busy = createVendor.isPending || updateVendor.isPending;

  async function handleSubmit() {
    setError(null);
    if (!name || !category || !approvalBasis) {
      setError("Name, category, and approval basis are required.");
      return;
    }
    try {
      if (initial) {
        await updateVendor.mutateAsync({ id: initial.id, body: { name, category, approval_basis: approvalBasis, otd_pct: Number(otdPct) || 100, status } });
      } else {
        await createVendor.mutateAsync({ name, category, approval_basis: approvalBasis, otd_pct: Number(otdPct) || 100, status });
      }
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Failed to save vendor.");
    }
  }

  return (
    <Modal
      title={initial ? `Edit ${initial.name}` : "New Vendor"}
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
      <Field label="Vendor Name">
        <TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Precision Chemical Supply" />
      </Field>
      <Field label="Category">
        <TextInput value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Controlled Production Chemicals" />
      </Field>
      <Field label="Approval Basis">
        <TextInput value={approvalBasis} onChange={(e) => setApprovalBasis(e.target.value)} placeholder="AS9100 §8.4 survey" />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="OTD %">
          <TextInput type="number" min={0} max={100} value={otdPct} onChange={(e) => setOtdPct(e.target.value)} />
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="Approved">Approved</option>
            <option value="Conditional">Conditional</option>
            <option value="Suspended">Suspended</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

export function VendorsPage() {
  const { data: vendors, isLoading } = useVendors();
  const archiveVendor = useArchiveVendor();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<number | null>(null);

  const columns: Column<Vendor>[] = [
    { header: "Vendor", first: true, render: (v) => <span style={{ fontWeight: 600 }}>{v.name}</span> },
    { header: "Category", render: (v) => <span style={{ color: colors.textMuted }}>{v.category}</span> },
    { header: "Approval Basis", render: (v) => <span style={{ fontSize: 11 }}>{v.approval_basis}</span> },
    { header: "OTD", align: "right", render: (v) => <span style={{ fontFamily: fontMono, color: v.otd_pct < 90 ? colors.amber : colors.text }}>{v.otd_pct}%</span> },
    { header: "Survey Due", render: (v) => <span style={{ fontFamily: fontMono, fontSize: 11, color: v.survey_overdue ? colors.red : colors.textMuted }}>{v.survey_overdue ? `OVERDUE ${fmtDate(v.survey_due_at)}` : fmtDate(v.survey_due_at)}</span> },
    { header: "Status", render: (v) => <Chip kind={statusKind(v.status)} text={v.status} /> },
    {
      header: "",
      last: true,
      align: "right",
      render: (v) => (
        <span style={{ display: "inline-flex", gap: 8 }}>
          <button
            onClick={() => setEditing(v)}
            style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", background: "#FFF", color: colors.accentDefault, border: `1px solid ${colors.cardBorder}`, borderRadius: 4, cursor: "pointer" }}
          >
            Edit
          </button>
          {confirmArchiveId === v.id ? (
            <>
              <button
                onClick={() => archiveVendor.mutate(v.id, { onSuccess: () => setConfirmArchiveId(null) })}
                style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", background: colors.red, color: "#FFF", border: "none", borderRadius: 4, cursor: "pointer" }}
              >
                Confirm
              </button>
              <button onClick={() => setConfirmArchiveId(null)} style={{ fontSize: 11, padding: "4px 8px", background: "transparent", border: `1px solid ${colors.cardBorder}`, borderRadius: 4, cursor: "pointer" }}>
                ✕
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmArchiveId(v.id)}
              style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", background: "#FFF", color: colors.red, border: `1px solid ${colors.red}`, borderRadius: 4, cursor: "pointer" }}
            >
              Archive
            </button>
          )}
        </span>
      ),
    },
  ];

  return (
    <section>
      <div style={{ display: "flex", marginBottom: 14 }}>
        <button
          onClick={() => setShowNew(true)}
          style={{ background: colors.accentDefault, color: "#FFFFFF", border: "none", borderRadius: 5, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          + New Vendor
        </button>
      </div>
      <Card>{isLoading || !vendors ? <div style={{ padding: 20, fontSize: 12 }}>Loading…</div> : <Table columns={columns} rows={vendors} keyFn={(v) => String(v.id)} />}</Card>
      {showNew ? <VendorModal onClose={() => setShowNew(false)} /> : null}
      {editing ? <VendorModal initial={editing} onClose={() => setEditing(null)} /> : null}
    </section>
  );
}
