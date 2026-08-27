import { colors, fontMono, invoiceStatusKind } from "../lib/theme";
import { useInvoices } from "../lib/queries";
import { Card, Table, type Column } from "../components/Table";
import { Chip } from "../components/Chip";
import type { Invoice } from "../lib/types";

/** QuickBooks Online is currently hidden — the sync banner, the per-row "Sync now"
 *  buttons and the QUICKBOOKS column were removed, along with the useQbStatusQuery /
 *  useSyncAllInvoices / useSyncInvoice hooks that fed them. The backend integration and
 *  the invoices' qb_sync_status field are untouched, so restoring this is re-adding the
 *  column and re-registering the router. */
export function InvoicingPage() {
  const { data: invoices, isLoading } = useInvoices();

  const columns: Column<Invoice>[] = [
    { header: "Invoice", first: true, render: (i) => <span style={{ fontFamily: fontMono, fontWeight: 600, color: colors.accentDefault }}>{i.id}</span> },
    { header: "Customer", render: (i) => <span style={{ fontWeight: 600 }}>{i.customer.name}</span> },
    { header: "Jobs", render: (i) => <span style={{ fontFamily: fontMono, fontSize: 11, color: colors.textMuted }}>{i.lines.map((l) => l.job_id ?? l.description).filter(Boolean).join(", ") || "—"}</span> },
    { header: "Amount", align: "right", render: (i) => <span style={{ fontFamily: fontMono, fontWeight: 600 }}>${i.amount.toLocaleString()}</span> },
    { header: "Terms", render: (i) => <span style={{ fontSize: 11, color: colors.textMuted }}>{i.terms}</span> },
    { header: "Status", last: true, render: (i) => <Chip kind={invoiceStatusKind(i.status)} text={i.status} /> },
  ];

  return (
    <section>
      <div style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "center" }}>
        <div style={{ fontSize: 12, color: colors.textMuted }}>Invoices generate from shipped jobs.</div>
      </div>
      <Card>{isLoading || !invoices ? <div style={{ padding: 20, fontSize: 12 }}>Loading…</div> : <Table columns={columns} rows={invoices} keyFn={(i) => i.id} />}</Card>
    </section>
  );
}
