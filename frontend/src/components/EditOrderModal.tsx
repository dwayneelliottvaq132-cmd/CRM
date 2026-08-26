import { useState } from "react";
import { useUpdateOrder } from "../lib/queries";
import { Field, FormError, Modal, PrimaryButton, SecondaryButton, TextInput } from "./Modal";
import type { Order } from "../lib/types";

export function EditOrderModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const updateOrder = useUpdateOrder();
  const [customerPo, setCustomerPo] = useState(order.customer_po);
  const [partNumber, setPartNumber] = useState(order.part_number);
  const [spec, setSpec] = useState(order.spec);
  const [qty, setQty] = useState(String(order.qty));
  const [value, setValue] = useState(String(order.value));
  const [dueDate, setDueDate] = useState(order.due_date ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!customerPo || !partNumber || !spec || !qty || !value) {
      setError("All fields except due date are required.");
      return;
    }
    try {
      await updateOrder.mutateAsync({
        id: order.id,
        body: { customer_po: customerPo, part_number: partNumber, spec, qty: Number(qty), value: Number(value), due_date: dueDate || null },
      });
      onClose();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Failed to save.");
    }
  }

  return (
    <Modal
      title={`Edit ${order.id}`}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={handleSubmit} disabled={updateOrder.isPending}>
            {updateOrder.isPending ? "Saving…" : "Save Changes"}
          </PrimaryButton>
        </>
      }
    >
      <FormError message={error} />
      <Field label="Customer" hint="Customer can't be changed after creation">
        <TextInput value={order.customer.name} disabled />
      </Field>
      <Field label="Customer PO">
        <TextInput autoFocus value={customerPo} onChange={(e) => setCustomerPo(e.target.value)} />
      </Field>
      <Field label="Part Number">
        <TextInput value={partNumber} onChange={(e) => setPartNumber(e.target.value)} />
      </Field>
      <Field label="Governing Spec">
        <TextInput value={spec} onChange={(e) => setSpec(e.target.value)} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Qty">
          <TextInput type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field label="Value ($)">
          <TextInput type="number" min={0} step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
      </div>
      <Field label="Due Date" hint="Optional">
        <TextInput type="date" value={dueDate ?? ""} onChange={(e) => setDueDate(e.target.value)} />
      </Field>
    </Modal>
  );
}
