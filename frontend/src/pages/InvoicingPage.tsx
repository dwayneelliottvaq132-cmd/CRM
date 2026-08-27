import { colors, fontMono, invoiceStatusKind } from "../lib/theme";
import { useInvoices, useQbStatusQuery, useSyncAllInvoices, useSyncInvoice } from "../lib/queries";
import { Card, Table, type Column } from "../components/Table";
import { Chip } from "../components/Chip";
import type { Invoice } from "../lib/types";

export function InvoicingPage() {
  const { data: invoices, isLoading } = useInvoices();
  const { data: qb } = useQbStatusQuery();
  const syncAll = useSyncAllInvoices();
  const syncOne = useSyncInvoice();

  const columns: Column<Invoice>[] = [
    { header: "Invoice", first: true, render: (i) => <span style={{ fontFamily: fontMono, fontWeight: 600, color: colors.accentDefault }}>{i.id}</span> },
    { header: "Customer", render: (i) => <span style={{ fontWeight: 600 }}>{i.customer.name}</span> },
    { header: "Jobs", render: (i) => <span style={{ fontFamily: fontMono, fontSize: 11, color: colors.textMuted }}>{i.lines.map((l) => l.job_id ?? l.description).filter(Boolean).join(", ") || "—"}</span> },
    { header: "Amount", align: "right", render: (i) => <span style={{ fontFamily: fontMono, fontWeight: 600 }}>${i.amount.toLocaleString()}</span> },
    { header: "Terms", render: (i) => <span style={{ fontSize: 11, color: colors.textMuted }}>{i.terms}</span> },
    { header: "Status", render: (i) => <Chip kind={invoiceStatusKind(i.status)} text={i.status} /> },
    {
      header: "QuickBooks",
      last: true,
      render: (i) => {
        const syncable = i.qb_sync_status === "Pending" || i.qb_sync_status === "Not synced" || i.qb_sync_status === "Error";
        if (syncable) {
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                syncOne.mutate(i.id);
              }}
              disabled={syncOne.isPending}
              style={{ background: "#FFFFFF", color: colors.accentDefault, border: "1px solid #B7CBD9", borderRadius: 5, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
            >
              Sync now →
            </button>
          );
        }
        const color = i.qb_sync_status === "Synced" ? colors.green : i.qb_sync_status === "Syncing" ? colors.accentDefault : colors.gray;
        return <span style={{ fontSize: 11, fontWeight: 600, color }}>{i.qb_sync_status === "Syncing" ? "⟳ Syncing…" : i.qb_sync_status}</span>;
      },
    },
  ];

  return (
    <section>
      <div style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FFFFFF", border: `1px solid ${colors.cardBorder}`, borderRadius: 6, padding: "8px 14px" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: qb?.connected || qb?.mode === "simulated" ? colors.green : colors.gray }} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>QuickBooks Online</span>
          <span style={{ fontSize: 11, color: colors.textFaint }}>{qb?.detail ?? "checking…"}</span>
        </div>
        <button
          onClick={() => syncAll.mutate()}
          disabled={syncAll.isPending}
          style={{ background: colors.accentDefault, color: "#FFFFFF", border: "none", borderRadius: 5, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          {syncAll.isPending ? "⟳ Syncing to QuickBooks…" : "Sync All Pending →"}
        </button>
        <div style={{ marginLeft: "auto", fontSize: 12, color: colors.textMuted }}>Invoices generate from shipped jobs; customers, items &amp; taxes map to QuickBooks automatically.</div>
      </div>
      <Card>{isLoading || !invoices ? <div style={{ padding: 20, fontSize: 12 }}>Loading…</div> : <Table columns={columns} rows={invoices} keyFn={(i) => i.id} />}</Card>
    </section>
  );
}
