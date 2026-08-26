import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateCustomer, useCreateOrder, useCustomers } from "../lib/queries";
import { Field, FormError, Modal, PrimaryButton, SecondaryButton, Select, TextInput } from "./Modal";

export function NewOrderModal({ kind, onClose }: { kind: "order" | "quote"; onClose: () => void }) {
  const { data: customers } = useCustomers();
  const createOrder = useCreateOrder();
  const createCustomer = useCreateCustomer();
  const navigate = useNavigate();

  const [customerId, setCustomerId] = useState<string>("");
  const [newCustomerMode, setNewCustomerMode] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [customerPo, setCustomerPo] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [spec, setSpec] = useState("");
  const [qty, setQty] = useState("");
  const [value, setValue] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const busy = createOrder.isPending || createCustomer.isPending;

  async function handleSubmit() {
    setError(null);
    try {
      let cid = customerId ? Number(customerId) : null;
      if (newCustomerMode) {
        if (newCustomerName.trim().length < 2) {
          setError("Customer name is required.");
          return;
        }
        const customer = await createCustomer.mutateAsync({ name: newCustomerName.trim() });
        cid = customer.id;
      }
      if (!cid) {
        setError("Select or create a customer.");
        return;
      }
      if (!customerPo || !partNumber || !spec || !qty || !value) {
        setError("All fields except due date are required.");
        return;
      }
      const order = await createOrder.mutateAsync({
        kind,
        customer_id: cid,
        customer_po: customerPo,
        part_number: partNumber,
        spec,
        qty: Number(qty),
        value: Number(value),
        due_date: dueDate || null,
      });
      onClose();
      navigate(kind === "quote" ? `/quoting#${order.id}` : `/sales-orders#${order.id}`);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Failed to create.");
    }
  }

  return (
    <Modal
      title={kind === "quote" ? "New Quote" : "New Order"}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={handleSubmit} disabled={busy}>
            {busy ? "Creating…" : "Create"}
          </PrimaryButton>
        </>
      }
    >
      <FormError message={error} />
      <Field label="Customer">
        {newCustomerMode ? (
          <div style={{ display: "flex", gap: 8 }}>
            <TextInput autoFocus value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="New customer name" />
            <SecondaryButton type="button" onClick={() => setNewCustomerMode(false)}>
              Cancel
            </SecondaryButton>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select customer…</option>
              {(customers ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <SecondaryButton type="button" onClick={() => setNewCustomerMode(true)}>
              + New
            </SecondaryButton>
          </div>
        )}
      </Field>
      <Field label="Customer PO">
        <TextInput value={customerPo} onChange={(e) => setCustomerPo(e.target.value)} placeholder="PO-48213" />
      </Field>
      <Field label="Part Number">
        <TextInput value={partNumber} onChange={(e) => setPartNumber(e.target.value)} placeholder="10847-3" />
      </Field>
      <Field label="Governing Spec">
        <TextInput value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="MIL-A-8625 Type II Class 1" />
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
        <TextInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </Field>
    </Modal>
  );
}
