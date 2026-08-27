import { useState } from "react";
import { colors, fontMono, jobOrderStatusKind } from "../lib/theme";
import { fmtDate } from "../lib/format";
import { useDeleteOrder, useOrders } from "../lib/queries";
import { Card, Table, type Column } from "../components/Table";
import { Chip } from "../components/Chip";
import { NewOrderModal } from "../components/NewOrderModal";
import { EditOrderModal } from "../components/EditOrderModal";
import { DrawingScanPanel } from "../components/DrawingScanPanel";
import type { Order } from "../lib/types";

export function QuotingPage() {
  const { data: orders, isLoading } = useOrders();
  const deleteOrder = useDeleteOrder();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const quotes = (orders ?? []).filter((o) => o.kind === "quote");

  const columns: Column<Order>[] = [
    { header: "Quote", first: true, render: (o) => <span style={{ fontFamily: fontMono, fontWeight: 600, color: colors.accentDefault }}>{o.id}</span> },
    {
      header: "Customer / PO",
      render: (o) => (
        <div>
          <div style={{ fontWeight: 600 }}>{o.customer.name}</div>
          <div style={{ fontFamily: fontMono, fontSize: 10, color: colors.textFaint }}>{o.customer_po}</div>
        </div>
      ),
    },
    { header: "Part", render: (o) => <span style={{ fontFamily: fontMono, fontSize: 11 }}>{o.part_number}</span> },
    { header: "Spec", render: (o) => <span style={{ fontFamily: fontMono, fontSize: 11, color: colors.textMuted }}>{o.spec}</span> },
    { header: "Qty", align: "right", render: (o) => <span style={{ fontFamily: fontMono }}>{o.qty}</span> },
    { header: "Value", align: "right", render: (o) => <span style={{ fontFamily: fontMono }}>${o.value.toLocaleString()}</span> },
    { header: "Due", render: (o) => <span style={{ fontFamily: fontMono, fontSize: 11 }}>{fmtDate(o.due_date)}</span> },
    { header: "Status", render: (o) => <Chip kind={jobOrderStatusKind(o.status)} text={o.status} /> },
    {
      header: "",
      last: true,
      align: "right",
      render: (o) => (
        <span style={{ display: "inline-flex", gap: 8 }}>
          <button
            onClick={() => setEditing(o)}
            style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", background: "#FFF", color: colors.accentDefault, border: `1px solid ${colors.cardBorder}`, borderRadius: 4, cursor: "pointer" }}
          >
            Edit
          </button>
          {confirmDeleteId === o.id ? (
            <>
              <button
                onClick={() => deleteOrder.mutate(o.id, { onSuccess: () => setConfirmDeleteId(null) })}
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
              onClick={() => setConfirmDeleteId(o.id)}
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
    <section style={{ display: "grid", gap: 24 }}>
      <div>
        <div style={{ display: "flex", marginBottom: 14 }}>
          <button
            onClick={() => setShowNew(true)}
            style={{ background: colors.accentDefault, color: "#FFFFFF", border: "none", borderRadius: 5, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            + New Quote
          </button>
          <div style={{ marginLeft: "auto", fontSize: 12, color: colors.textMuted, alignSelf: "center" }}>
            {quotes.length} quote(s). When a quote turns into real business, create the matching order in Sales Orders.
          </div>
        </div>
        <Card>{isLoading || !orders ? <div style={{ padding: 20, fontSize: 12 }}>Loading…</div> : <Table columns={columns} rows={quotes} keyFn={(o) => o.id} />}</Card>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Scan a Drawing (reference)</div>
        <DrawingScanPanel />
      </div>

      {showNew ? <NewOrderModal kind="quote" onClose={() => setShowNew(false)} /> : null}
      {editing ? <EditOrderModal order={editing} onClose={() => setEditing(null)} /> : null}
    </section>
  );
}
