import { useState } from "react";
import { colors, fontMono } from "../lib/theme";
import { fmtDate } from "../lib/format";
import { useCreateInventoryLot, useDeleteInventoryLot, useInventory, useUpdateInventoryLot, useVendors } from "../lib/queries";
import { Card, Table, type Column } from "../components/Table";
import { Chip } from "../components/Chip";
import { Field, FormError, Modal, PrimaryButton, SecondaryButton, Select, TextInput } from "../components/Modal";
import type { InventoryLot } from "../lib/types";

function lotStatus(l: InventoryLot): { label: string; kind: "good" | "warn" | "bad" } {
  const now = new Date();
  if (l.expires_at && new Date(l.expires_at) < now) return { label: "Expired lot", kind: "bad" };
  if (l.expires_at && new Date(l.expires_at).getTime() - now.getTime() < 45 * 86400000) return { label: "Expiring", kind: "warn" };
  if (l.on_hand_qty <= l.reorder_at_qty) return { label: "Reorder", kind: "warn" };
  return { label: "OK", kind: "good" };
}

function LotModal({ initial, onClose }: { initial?: InventoryLot; onClose: () => void }) {
  const { data: vendors } = useVendors();
  const createLot = useCreateInventoryLot();
  const updateLot = useUpdateInventoryLot();
  const [chemicalName, setChemicalName] = useState(initial?.chemical_name ?? "");
  const [lotNumber, setLotNumber] = useState(initial?.lot_number ?? "");
  const [vendorId, setVendorId] = useState(initial?.vendor ? String(initial.vendor.id) : "");
  const [onHandQty, setOnHandQty] = useState(initial ? String(initial.on_hand_qty) : "");
  const [onHandUnit, setOnHandUnit] = useState(initial?.on_hand_unit ?? "gal");
  const [reorderAt, setReorderAt] = useState(initial ? String(initial.reorder_at_qty) : "");
  const [expiresAt, setExpiresAt] = useState(initial?.expires_at ?? "");
  const [error, setError] = useState<string | null>(null);

  const busy = createLot.isPending || updateLot.isPending;

  async function handleSubmit() {
    setError(null);
    if (!chemicalName || !lotNumber || !vendorId || !onHandQty || !reorderAt) {
      setError("All fields except expiration are required.");
      return;
    }
    const body = {
      chemical_name: chemicalName,
      lot_number: lotNumber,
      vendor_id: Number(vendorId),
      on_hand_qty: Number(onHandQty),
      on_hand_unit: onHandUnit,
      reorder_at_qty: Number(reorderAt),
      expires_at: expiresAt || null,
    };
    try {
      if (initial) {
        await updateLot.mutateAsync({ id: initial.id, body });
      } else {
        await createLot.mutateAsync(body);
      }
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Failed to save lot.");
    }
  }

  return (
    <Modal
      title={initial ? `Edit Lot ${initial.lot_number}` : "New Inventory Lot"}
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
      <Field label="Chemical Name">
        <TextInput autoFocus value={chemicalName} onChange={(e) => setChemicalName(e.target.value)} placeholder="Sulfuric Acid 98%" />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Lot Number">
          <TextInput value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} placeholder="L-260412" />
        </Field>
        <Field label="Vendor">
          <Select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">Select vendor…</option>
            {(vendors ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Field label="On Hand Qty">
          <TextInput type="number" min={0} step="0.01" value={onHandQty} onChange={(e) => setOnHandQty(e.target.value)} />
        </Field>
        <Field label="Unit">
          <TextInput value={onHandUnit} onChange={(e) => setOnHandUnit(e.target.value)} placeholder="gal" />
        </Field>
        <Field label="Reorder At">
          <TextInput type="number" min={0} step="0.01" value={reorderAt} onChange={(e) => setReorderAt(e.target.value)} />
        </Field>
      </div>
      <Field label="Expires" hint="Optional">
        <TextInput type="date" value={expiresAt ?? ""} onChange={(e) => setExpiresAt(e.target.value)} />
      </Field>
    </Modal>
  );
}

export function InventoryPage() {
  const { data: stock, isLoading } = useInventory();
  const deleteLot = useDeleteInventoryLot();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<InventoryLot | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const columns: Column<InventoryLot>[] = [
    { header: "Chemical", first: true, render: (s) => <span style={{ fontWeight: 600 }}>{s.chemical_name}</span> },
    { header: "Lot", render: (s) => <span style={{ fontFamily: fontMono, fontSize: 11 }}>{s.lot_number}</span> },
    { header: "Vendor", render: (s) => <span style={{ color: colors.textMuted }}>{s.vendor?.name ?? "—"}</span> },
    {
      header: "On Hand",
      align: "right",
      render: (s) => {
        const status = lotStatus(s);
        return (
          <span style={{ fontFamily: fontMono, fontWeight: 600, color: status.kind === "warn" && status.label === "Reorder" ? colors.amber : colors.text }}>
            {s.on_hand_qty} {s.on_hand_unit}
          </span>
        );
      },
    },
    { header: "Reorder At", align: "right", render: (s) => <span style={{ fontFamily: fontMono, color: colors.textFaint }}>{s.reorder_at_qty} {s.on_hand_unit}</span> },
    {
      header: "Expires",
      render: (s) => {
        const status = lotStatus(s);
        return (
          <span style={{ fontFamily: fontMono, fontSize: 11, color: status.label === "Expired lot" ? colors.red : status.label === "Expiring" ? colors.amber : colors.textMuted }}>
            {fmtDate(s.expires_at)}
          </span>
        );
      },
    },
    {
      header: "Status",
      render: (s) => {
        const status = lotStatus(s);
        return <Chip kind={status.kind} text={status.label} />;
      },
    },
    {
      header: "",
      last: true,
      align: "right",
      render: (s) => (
        <span style={{ display: "inline-flex", gap: 8 }}>
          <button
            onClick={() => setEditing(s)}
            style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", background: "#FFF", color: colors.accentDefault, border: `1px solid ${colors.cardBorder}`, borderRadius: 4, cursor: "pointer" }}
          >
            Edit
          </button>
          {confirmDeleteId === s.id ? (
            <>
              <button
                onClick={() => deleteLot.mutate(s.id, { onSuccess: () => setConfirmDeleteId(null) })}
                style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", background: colors.red, color: "#FFF", border: "none", borderRadius: 4, cursor: "pointer" }}
              >
                Confirm
              </button>
              <button onClick={() => setConfirmDeleteId(null)} style={{ fontSize: 11, padding: "4px 8px", background: "transparent", border: `1px solid ${colors.cardBorder}`, borderRadius: 4, cursor: "pointer" }}>
                ✕
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDeleteId(s.id)}
              style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", background: "#FFF", color: colors.red, border: `1px solid ${colors.red}`, borderRadius: 4, cursor: "pointer" }}
            >
              Delete
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
          + New Lot
        </button>
      </div>
      <Card>{isLoading || !stock ? <div style={{ padding: 20, fontSize: 12 }}>Loading…</div> : <Table columns={columns} rows={stock} keyFn={(s) => String(s.id)} />}</Card>
      <div style={{ fontSize: 11, color: colors.textFaint, marginTop: 10 }}>
        Lot numbers trace to bath make-ups and additions — every cert can trace back to the chemical lots in the tank at time of processing.
      </div>
      {showNew ? <LotModal onClose={() => setShowNew(false)} /> : null}
      {editing ? <LotModal initial={editing} onClose={() => setEditing(null)} /> : null}
    </section>
  );
}
