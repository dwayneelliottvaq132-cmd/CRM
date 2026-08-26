import { useState } from "react";
import { colors } from "../lib/theme";
import { useArchiveCustomer, useCreateCustomer, useCustomers, useUpdateCustomer } from "../lib/queries";
import { Card, Table, type Column } from "../components/Table";
import { Chip } from "../components/Chip";
import { Field, FormError, Modal, PrimaryButton, SecondaryButton, TextInput } from "../components/Modal";
import type { Customer } from "../lib/types";

function CustomerModal({ initial, onClose }: { initial?: Customer; onClose: () => void }) {
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const [name, setName] = useState(initial?.name ?? "");
  const [itar, setItar] = useState(initial?.itar_registered ?? false);
  const [requireApprovedRouting, setRequireApprovedRouting] = useState(initial?.require_approved_routing ?? false);
  const [requiresContractReview, setRequiresContractReview] = useState(initial?.requires_contract_review ?? false);
  const [qualityStandards, setQualityStandards] = useState(initial?.quality_standards ?? "");
  const [error, setError] = useState<string | null>(null);

  const busy = createCustomer.isPending || updateCustomer.isPending;

  async function handleSubmit() {
    setError(null);
    if (name.trim().length < 2) {
      setError("Customer name is required.");
      return;
    }
    try {
      const body = { name, itar_registered: itar, require_approved_routing: requireApprovedRouting, requires_contract_review: requiresContractReview, quality_standards: qualityStandards };
      if (initial) {
        await updateCustomer.mutateAsync({ id: initial.id, body });
      } else {
        await createCustomer.mutateAsync(body);
      }
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Failed to save customer.");
    }
  }

  return (
    <Modal
      title={initial ? `Edit ${initial.name}` : "New Customer"}
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
      <Field label="Customer Name">
        <TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Meridian Aerospace" />
      </Field>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginTop: 4 }}>
        <input type="checkbox" checked={itar} onChange={(e) => setItar(e.target.checked)} />
        ITAR registered
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginTop: 8 }}>
        <input type="checkbox" checked={requireApprovedRouting} onChange={(e) => setRequireApprovedRouting(e.target.checked)} />
        Require an approved routing plan before a job can be created for this customer
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginTop: 8 }}>
        <input type="checkbox" checked={requiresContractReview} onChange={(e) => setRequiresContractReview(e.target.checked)} />
        Require a completed contract review before an order can become a work order (AS9100 §8.2.3)
      </label>
      {requiresContractReview ? (
        <Field label="Quality standards held to (reference)">
          <TextInput value={qualityStandards} onChange={(e) => setQualityStandards(e.target.value)} placeholder="AS9100D, NADCAP AC7108" />
        </Field>
      ) : null}
    </Modal>
  );
}

export function CustomersPage() {
  const { data: customers, isLoading } = useCustomers();
  const archiveCustomer = useArchiveCustomer();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<number | null>(null);

  const columns: Column<Customer>[] = [
    { header: "Customer", first: true, render: (c) => <span style={{ fontWeight: 600 }}>{c.name}</span> },
    { header: "ITAR", render: (c) => (c.itar_registered ? <Chip kind="dark" text="ITAR Registered" /> : <span style={{ color: colors.textFaint }}>—</span>) },
    { header: "Routing Plan", render: (c) => (c.require_approved_routing ? <Chip kind="warn" text="Required" /> : <span style={{ color: colors.textFaint }}>Optional</span>) },
    {
      header: "",
      last: true,
      align: "right",
      render: (c) => (
        <span style={{ display: "inline-flex", gap: 8 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditing(c);
            }}
            style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", background: "#FFF", color: colors.accentDefault, border: `1px solid ${colors.cardBorder}`, borderRadius: 4, cursor: "pointer" }}
          >
            Edit
          </button>
          {confirmArchiveId === c.id ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  archiveCustomer.mutate(c.id, { onSuccess: () => setConfirmArchiveId(null) });
                }}
                style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", background: colors.red, color: "#FFF", border: "none", borderRadius: 4, cursor: "pointer" }}
              >
                Confirm
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmArchiveId(null);
                }}
                style={{ fontSize: 11, padding: "4px 8px", background: "transparent", border: `1px solid ${colors.cardBorder}`, borderRadius: 4, cursor: "pointer" }}
              >
                ✕
              </button>
            </>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmArchiveId(c.id);
              }}
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
          + New Customer
        </button>
      </div>
      <Card>{isLoading || !customers ? <div style={{ padding: 20, fontSize: 12 }}>Loading…</div> : <Table columns={columns} rows={customers} keyFn={(c) => String(c.id)} />}</Card>
      <div style={{ fontSize: 11, color: colors.textFaint, marginTop: 10 }}>
        Archiving hides a customer from pickers on Orders/Travelers — historical orders, jobs, and invoices stay intact.
      </div>
      {showNew ? <CustomerModal onClose={() => setShowNew(false)} /> : null}
      {editing ? <CustomerModal initial={editing} onClose={() => setEditing(null)} /> : null}
    </section>
  );
}
