import { useState } from "react";
import { colors, fontMono } from "../lib/theme";
import { fmtDate } from "../lib/format";
import { useArchiveEquipment, useCreateEquipment, useEquipment, useUpdateEquipment } from "../lib/queries";
import { Card, Table, type Column } from "../components/Table";
import { Chip } from "../components/Chip";
import { Field, FormError, Modal, PrimaryButton, SecondaryButton, TextInput } from "../components/Modal";
import type { Equipment } from "../lib/types";

function equipmentStatus(e: Equipment): { label: string; kind: "good" | "warn" | "bad" } {
  if (!e.due_at) return { label: "Current", kind: "good" };
  const due = new Date(e.due_at);
  const now = new Date();
  const in14Days = new Date(now.getTime() + 14 * 86400000);
  if (due < now) return { label: "OVERDUE", kind: "bad" };
  if (due < in14Days) return { label: "Due Soon", kind: "warn" };
  return { label: "Current", kind: "good" };
}

function EquipmentModal({ initial, onClose }: { initial?: Equipment; onClose: () => void }) {
  const createEquipment = useCreateEquipment();
  const updateEquipment = useUpdateEquipment();
  const [name, setName] = useState(initial?.name ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [intervalMonths, setIntervalMonths] = useState(String(initial?.interval_months ?? 12));
  const [error, setError] = useState<string | null>(null);

  const busy = createEquipment.isPending || updateEquipment.isPending;

  async function handleSubmit() {
    setError(null);
    if (!name || !location) {
      setError("Name and location are required.");
      return;
    }
    try {
      if (initial) {
        await updateEquipment.mutateAsync({ id: initial.id, body: { name, location, interval_months: Number(intervalMonths) || 12 } });
      } else {
        await createEquipment.mutateAsync({ name, location, interval_months: Number(intervalMonths) || 12 });
      }
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Failed to save equipment.");
    }
  }

  return (
    <Modal
      title={initial ? `Edit ${initial.id}` : "New Equipment"}
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
      <Field label="Equipment Name">
        <TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="pH Meter — Line 2" />
      </Field>
      <Field label="Location">
        <TextInput value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Anodize Bay" />
      </Field>
      <Field label="Calibration Interval (months)">
        <TextInput type="number" min={1} value={intervalMonths} onChange={(e) => setIntervalMonths(e.target.value)} />
      </Field>
    </Modal>
  );
}

export function CalibrationPage() {
  const { data: equipment, isLoading } = useEquipment();
  const archiveEquipment = useArchiveEquipment();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);

  const columns: Column<Equipment>[] = [
    { header: "Asset", first: true, render: (e) => <span style={{ fontFamily: fontMono, fontWeight: 600 }}>{e.id}</span> },
    { header: "Equipment", render: (e) => <span style={{ fontWeight: 600 }}>{e.name}</span> },
    { header: "Location", render: (e) => <span style={{ color: colors.textMuted }}>{e.location}</span> },
    { header: "Interval", render: (e) => <span style={{ fontFamily: fontMono, fontSize: 11 }}>{e.interval_text}</span> },
    { header: "Last Cal", render: (e) => <span style={{ fontFamily: fontMono, fontSize: 11 }}>{fmtDate(e.last_calibrated_at)}</span> },
    {
      header: "Due",
      render: (e) => {
        const s = equipmentStatus(e);
        return <span style={{ fontFamily: fontMono, fontSize: 11, fontWeight: 600, color: s.kind === "bad" ? colors.red : s.kind === "warn" ? colors.amber : colors.textMuted }}>{fmtDate(e.due_at)}</span>;
      },
    },
    {
      header: "Status",
      render: (e) => {
        const s = equipmentStatus(e);
        return <Chip kind={s.kind} text={s.label} />;
      },
    },
    {
      header: "",
      last: true,
      align: "right",
      render: (e) => (
        <span style={{ display: "inline-flex", gap: 8 }}>
          <button
            onClick={() => setEditing(e)}
            style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", background: "#FFF", color: colors.accentDefault, border: `1px solid ${colors.cardBorder}`, borderRadius: 4, cursor: "pointer" }}
          >
            Edit
          </button>
          {confirmArchiveId === e.id ? (
            <>
              <button
                onClick={() => archiveEquipment.mutate(e.id, { onSuccess: () => setConfirmArchiveId(null) })}
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
              onClick={() => setConfirmArchiveId(e.id)}
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
          + New Equipment
        </button>
      </div>
      <Card>
        {isLoading || !equipment ? (
          <div style={{ padding: 20, fontSize: 12 }}>Loading…</div>
        ) : (
          <Table columns={columns} rows={equipment} keyFn={(e) => e.id} rowBg={(e) => (equipmentStatus(e).kind === "bad" ? "#FBF3F1" : undefined)} />
        )}
      </Card>
      <div style={{ fontSize: 11, color: colors.textFaint, marginTop: 10 }}>
        Overdue instruments are locked out of traveler sign-offs — an operation requiring an overdue gauge cannot be completed.
      </div>
      {showNew ? <EquipmentModal onClose={() => setShowNew(false)} /> : null}
      {editing ? <EquipmentModal initial={editing} onClose={() => setEditing(null)} /> : null}
    </section>
  );
}
