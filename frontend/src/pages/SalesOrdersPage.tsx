import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { colors, fontMono, jobOrderStatusKind } from "../lib/theme";
import { fmtDate, fmtDateTime } from "../lib/format";
import {
  useAnalyzePo,
  useConvertOrder,
  useCustomers,
  useDeleteOrder,
  useGenerateSalesOrder,
  useOrders,
  usePoAnalyses,
  usePoAnalysis,
  usePoStatus,
} from "../lib/queries";
import { Card, Table, type Column } from "../components/Table";
import { Chip } from "../components/Chip";
import { Field, PrimaryButton, Select, TextInput } from "../components/Modal";
import { NewOrderModal } from "../components/NewOrderModal";
import { EditOrderModal } from "../components/EditOrderModal";
import { ContractReviewModal } from "../components/ContractReviewModal";
import { DrawingScanPanel } from "../components/DrawingScanPanel";
import type { ConfirmedLine, GenerateSalesOrderResult, Order, PurchaseOrderLineItem } from "../lib/types";

type Tab = "orders" | "scan" | "batch-scan";

interface EditableLine extends PurchaseOrderLineItem {
  spec: string;
  drawing_analysis_id: number | null;
}

function toEditable(item: PurchaseOrderLineItem): EditableLine {
  return {
    ...item,
    spec: item.spec_text ?? "",
    drawing_analysis_id: item.matched_drawing_analysis_id,
  };
}

function guessCustomerId(customers: { id: number; name: string }[] | undefined, guess: string | null): string {
  if (!customers || !guess) return "";
  const norm = guess.trim().toLowerCase();
  const hit = customers.find((c) => c.name.trim().toLowerCase() === norm) ?? customers.find((c) => norm.includes(c.name.trim().toLowerCase()) || c.name.trim().toLowerCase().includes(norm));
  return hit ? String(hit.id) : "";
}

function OrdersTab() {
  const { data: orders, isLoading } = useOrders();
  const convert = useConvertOrder();
  const deleteOrder = useDeleteOrder();
  const navigate = useNavigate();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const salesOrders = (orders ?? []).filter((o) => o.kind === "order");

  const columns: Column<Order>[] = [
    { header: "Order", first: true, render: (o) => <span style={{ fontFamily: fontMono, fontWeight: 600, color: colors.accentDefault }}>{o.id}</span> },
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
    {
      header: "Status",
      render: (o) => {
        // converted_job_id is only set when an order collapsed to exactly one job — a
        // multi-line order (e.g. from a multi-line PO scan) produces one job per line
        // instead, so fall back to the per-line job ids for those.
        const jobIds = o.converted_job_id ? [o.converted_job_id] : o.lines.map((l) => l.job_id).filter((id): id is string => !!id);
        const isConverted = o.status === "Converted" || jobIds.length > 0;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Chip kind={jobOrderStatusKind(o.status)} text={o.status} />
            {!isConverted && o.customer.requires_contract_review ? (
              <button
                onClick={(e) => { e.stopPropagation(); setReviewOrder(o); }}
                style={{ background: "#FFFFFF", color: "#7A5A1E", border: "1px solid #E3CD9E", borderRadius: 5, padding: "3px 8px", fontSize: 10, fontWeight: 600, cursor: "pointer" }}
              >
                Contract Review →
              </button>
            ) : !isConverted ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  convert.mutate(o.id, { onSuccess: (job) => navigate(`/travelers/${job.id}`) });
                }}
                disabled={convert.isPending}
                style={{ background: "#FFFFFF", color: colors.accentDefault, border: "1px solid #B7CBD9", borderRadius: 5, padding: "3px 8px", fontSize: 10, fontWeight: 600, cursor: "pointer" }}
              >
                Convert →
              </button>
            ) : jobIds.length > 0 ? (
              <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {jobIds.map((jobId) => (
                  <a
                    key={jobId}
                    href="#"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/travelers/${jobId}`); }}
                    style={{ fontSize: 10, fontFamily: fontMono, color: colors.accentDefault, fontWeight: 600 }}
                  >
                    {jobId}
                  </a>
                ))}
              </span>
            ) : (
              <span style={{ fontSize: 10, color: colors.textFaint }}>Converted</span>
            )}
          </div>
        );
      },
    },
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
          {!o.converted_job_id ? (
            confirmDeleteId === o.id ? (
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
            )
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", marginBottom: 14 }}>
        <button
          onClick={() => setShowNew(true)}
          style={{ background: colors.accentDefault, color: "#FFFFFF", border: "none", borderRadius: 5, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          + New Order
        </button>
        <div style={{ marginLeft: "auto", fontSize: 12, color: colors.textMuted, alignSelf: "center" }}>
          {salesOrders.length} order(s). Converting creates one work order per line and sends it to Planning.
        </div>
      </div>
      <Card>{isLoading || !orders ? <div style={{ padding: 20, fontSize: 12 }}>Loading…</div> : <Table columns={columns} rows={salesOrders} keyFn={(o) => o.id} />}</Card>
      {showNew ? <NewOrderModal kind="order" onClose={() => setShowNew(false)} /> : null}
      {editing ? <EditOrderModal order={editing} onClose={() => setEditing(null)} /> : null}
      {reviewOrder ? (
        <ContractReviewModal
          order={reviewOrder}
          onClose={() => setReviewOrder(null)}
          onAccepted={(jobId) => { setReviewOrder(null); navigate(`/travelers/${jobId}`); }}
        />
      ) : null}
    </div>
  );
}

function ScanPoTab() {
  const navigate = useNavigate();
  const { data: ai } = usePoStatus();
  const { data: analyses } = usePoAnalyses();
  const { data: customers } = useCustomers();
  const analyze = useAnalyzePo();
  const generate = useGenerateSalesOrder();

  const poFileInput = useRef<HTMLInputElement>(null);
  const drawingFileInput = useRef<HTMLInputElement>(null);
  const [poFile, setPoFile] = useState<File | null>(null);
  const [drawingFiles, setDrawingFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [customerPo, setCustomerPo] = useState("");
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [result, setResult] = useState<GenerateSalesOrderResult | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const effectiveId = selectedId ?? (analyses ?? [])[0]?.id;
  // fetch via the detail endpoint (not the list) — only it includes matched_drawings
  const { data: selected } = usePoAnalysis(effectiveId);

  useEffect(() => {
    if (!selected) return;
    setResult(null);
    setGenError(null);
    setCustomerId(guessCustomerId(customers, selected.customer_name_guess));
    setCustomerPo(selected.po_number ?? "");
    setLines((selected.line_items ?? []).map(toEditable));
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function submit() {
    if (!poFile) return;
    setError(null);
    analyze.mutate(
      { poFile, drawingFiles },
      {
        onSuccess: (res) => {
          setSelectedId(res.id);
          setPoFile(null);
          setDrawingFiles([]);
        },
        onError: (err: unknown) => {
          const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
          setError(detail ?? "Analysis failed");
        },
      },
    );
  }

  function updateLine(i: number, patch: Partial<EditableLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function handleGenerate() {
    if (!selected) return;
    setGenError(null);
    if (!customerId) {
      setGenError("Select which customer this PO belongs to.");
      return;
    }
    const confirmed: ConfirmedLine[] = lines.map((l) => ({
      line_no: l.line_no,
      part_number: l.part_number ?? "",
      revision: l.revision ?? "A",
      spec: l.spec,
      description: l.description,
      qty: l.qty ?? 0,
      unit_price: l.unit_price ?? 0,
      due_date: l.due_date,
      drawing_analysis_id: l.drawing_analysis_id,
      line_requirements: l.line_requirements,
    }));
    if (confirmed.some((l) => !l.part_number || !l.spec)) {
      setGenError("Every line needs a part number and a spec before generating.");
      return;
    }
    generate.mutate(
      { analysisId: selected.id, body: { customer_id: Number(customerId), customer_po: customerPo || null, lines: confirmed } },
      {
        onSuccess: (res) => setResult(res),
        onError: (err: unknown) => {
          const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
          setGenError(detail ?? "Generation failed");
        },
      },
    );
  }

  return (
    <section style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16, alignItems: "start" }}>
      <div style={{ display: "grid", gap: 16 }}>
        <Card>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${colors.rowBorder}`, fontSize: 13, fontWeight: 700 }}>
            Scan a Purchase Order
          </div>
          <div style={{ padding: 14 }}>
            {ai && !ai.configured ? (
              <div style={{ background: "#FFF8EC", border: "1px solid #E3C888", borderRadius: 6, padding: "8px 12px", fontSize: 11, color: "#8A6D1D", marginBottom: 12 }}>
                ⚠ {ai.detail}
              </div>
            ) : null}
            <div
              onClick={() => poFileInput.current?.click()}
              style={{ border: `2px dashed ${colors.cardBorder}`, background: "#FAFBFB", borderRadius: 8, padding: "16px", textAlign: "center", cursor: "pointer" }}
            >
              <div style={{ fontSize: 12, fontWeight: 600 }}>{poFile ? poFile.name : "Click to choose the PO PDF"}</div>
            </div>
            <input ref={poFileInput} type="file" accept="application/pdf" style={{ display: "none" }} onChange={(e) => setPoFile(e.target.files?.[0] ?? null)} />

            <div
              onClick={() => drawingFileInput.current?.click()}
              style={{ border: `2px dashed ${colors.cardBorder}`, background: "#FAFBFB", borderRadius: 8, padding: "16px", textAlign: "center", cursor: "pointer", marginTop: 10 }}
            >
              <div style={{ fontSize: 12, fontWeight: 600 }}>
                {drawingFiles.length > 0 ? `${drawingFiles.length} drawing(s) selected` : "Click to choose attached drawing PDF(s) — optional"}
              </div>
            </div>
            <input
              ref={drawingFileInput} type="file" accept="application/pdf" multiple style={{ display: "none" }}
              onChange={(e) => setDrawingFiles(Array.from(e.target.files ?? []))}
            />

            <PrimaryButton onClick={submit} disabled={!poFile || analyze.isPending} style={{ width: "100%", marginTop: 10 }}>
              {analyze.isPending ? "Scanning…" : "Scan PO + Drawings"}
            </PrimaryButton>
            {analyze.isPending ? (
              <div style={{ marginTop: 8, fontSize: 11, color: colors.accentDefault, fontFamily: fontMono }}>
                vision + reasoning pass over the PO and every attached drawing… this can take a minute or two
              </div>
            ) : null}
            {error ? (
              <div style={{ marginTop: 10, background: "#FBEFEF", border: `1px solid ${colors.red}`, borderRadius: 6, padding: "8px 12px", fontSize: 11, color: colors.red }}>
                {error}
              </div>
            ) : null}
            <div style={{ marginTop: 10, fontSize: 10, color: colors.textFaint }}>
              Model: <span style={{ fontFamily: fontMono }}>{ai?.model ?? "—"}</span> · results are advisory —
              review line items before generating the sales order.
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${colors.rowBorder}`, fontSize: 13, fontWeight: 700 }}>
            Past Scans
          </div>
          {(analyses ?? []).length === 0 ? (
            <div style={{ padding: 14, fontSize: 12, color: colors.textMuted }}>No purchase orders scanned yet.</div>
          ) : (
            (analyses ?? []).map((a) => {
              const active = selected?.id === a.id;
              return (
                <div
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className="row-hover"
                  style={{
                    padding: "10px 14px", borderTop: `1px solid ${colors.rowBorder}`, cursor: "pointer",
                    background: active ? "#F0F5F8" : "transparent",
                    borderLeft: `3px solid ${active ? colors.accentDefault : "transparent"}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: fontMono, fontSize: 12, fontWeight: 600, color: colors.accentDefault }}>
                      {a.po_number ?? a.filename}
                    </span>
                    <Chip kind={a.status === "Complete" ? "good" : "bad"} text={a.status} />
                  </div>
                  <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}>
                    {a.customer_name_guess ?? "(no customer read)"} · {(a.line_items ?? []).length} line(s) · {fmtDateTime(a.created_at)}
                  </div>
                </div>
              );
            })
          )}
        </Card>
      </div>

      <Card>
        {!selected ? (
          <div style={{ padding: 24, fontSize: 12, color: colors.textMuted }}>
            Scan a purchase order to review its line items here.
          </div>
        ) : selected.status !== "Complete" ? (
          <div style={{ padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.red }}>Analysis failed</div>
            <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 8, fontFamily: fontMono }}>{selected.error_detail}</div>
          </div>
        ) : result && result.order.status === "Pending Contract Review" ? (
          <div style={{ padding: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
              Sales Order <span style={{ fontFamily: fontMono, color: colors.accentDefault }}>{result.order.id}</span> created — Pending Contract Review
            </div>
            <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 16 }}>
              {result.order.lines.length} line(s) · customer {result.order.customer.name}. This customer requires a completed
              contract review (AS9100 §8.2.3) before work orders can be created. The scanned PO is linked to the sales order.
            </div>
            <div style={{ background: "#FFF8EC", border: "1px solid #E3C888", borderRadius: 6, padding: "10px 12px", fontSize: 12, color: "#6B5314" }}>
              Complete the Contract Review on {result.order.id} in the <a href="#" onClick={(e) => { e.preventDefault(); }} style={{ color: colors.accentDefault, fontWeight: 600 }}>Orders</a> tab above to release the work orders.
            </div>
          </div>
        ) : result ? (
          <div style={{ padding: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
              Sales Order <span style={{ fontFamily: fontMono, color: colors.accentDefault }}>{result.order.id}</span> created
            </div>
            <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 16 }}>{result.order.lines.length} line(s) · customer {result.order.customer.name}</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {["Line", "Part", "Job", "Planning", "Error"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "6px 8px", fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: colors.textFaint }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.line_results.map((r) => {
                  const line = result.order.lines.find((l) => l.job_id === r.job_id);
                  return (
                    <tr key={r.line_no} style={{ borderTop: `1px solid ${colors.rowBorder}` }}>
                      <td style={{ padding: "8px" }}>{r.line_no}</td>
                      <td style={{ padding: "8px", fontFamily: fontMono }}>{line?.part_number ?? "—"}</td>
                      <td style={{ padding: "8px" }}>
                        {r.job_id ? (
                          <a href={`/travelers/${r.job_id}`} onClick={(e) => { e.preventDefault(); navigate(`/travelers/${r.job_id}`); }} style={{ fontFamily: fontMono, color: colors.accentDefault, fontWeight: 600 }}>
                            {r.job_id}
                          </a>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "8px" }}>
                        {r.job_id ? (
                          <a href="/planning" onClick={(e) => { e.preventDefault(); navigate("/planning"); }}>
                            <Chip kind="warn" text="Needs Planning" />
                          </a>
                        ) : null}
                      </td>
                      <td style={{ padding: "8px", color: colors.red, fontSize: 11 }}>{r.error ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${colors.rowBorder}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: fontMono, fontSize: 17, fontWeight: 700 }}>{selected.po_number ?? "(no PO number found)"}</span>
                {selected.po_date ? <Chip kind="info" text={selected.po_date} /> : null}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
                <Field label="Customer" hint="The scan read a name off the PO — confirm which account this belongs to">
                  <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                    <option value="">Select customer…</option>
                    {(customers ?? []).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Customer PO #">
                  <TextInput value={customerPo} onChange={(e) => setCustomerPo(e.target.value)} />
                </Field>
              </div>
              {(selected.general_requirements ?? []).length > 0 ? (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: colors.textFaint, fontWeight: 600, marginBottom: 4 }}>PO-Wide Requirements</div>
                  {(selected.general_requirements ?? []).map((r, i) => (
                    <div key={i} style={{ fontSize: 12, marginTop: 2 }}>• {r}</div>
                  ))}
                </div>
              ) : null}
            </div>

            <div style={{ padding: "12px 20px 6px", fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", color: colors.textFaint, fontWeight: 700 }}>
              Line Items — review before generating
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {["#", "Part / Rev", "Spec", "Qty", "Unit $", "Matched Drawing"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "6px 8px", fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: colors.textFaint }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${colors.rowBorder}` }}>
                    <td style={{ padding: "6px 8px" }}>{l.line_no}</td>
                    <td style={{ padding: "6px 8px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <TextInput value={l.part_number ?? ""} onChange={(e) => updateLine(i, { part_number: e.target.value })} style={{ width: 110 }} placeholder="part #" />
                        <TextInput value={l.revision ?? ""} onChange={(e) => updateLine(i, { revision: e.target.value })} style={{ width: 44 }} placeholder="rev" />
                      </div>
                      {l.drawing_ref_text ? (
                        <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 3, maxWidth: 210 }}>
                          per PO: {l.drawing_ref_text}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <TextInput value={l.spec} onChange={(e) => updateLine(i, { spec: e.target.value })} style={{ width: 220 }} placeholder="governing spec" />
                      {l.line_requirements.length > 0 ? (
                        <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 3, maxWidth: 210 }}>
                          {l.line_requirements.join("; ")}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <TextInput type="number" value={l.qty ?? 0} onChange={(e) => updateLine(i, { qty: Number(e.target.value) })} style={{ width: 60 }} />
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <TextInput type="number" value={l.unit_price ?? 0} onChange={(e) => updateLine(i, { unit_price: Number(e.target.value) })} style={{ width: 70 }} />
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <Select value={l.drawing_analysis_id ?? ""} onChange={(e) => updateLine(i, { drawing_analysis_id: e.target.value ? Number(e.target.value) : null })} style={{ width: 160 }}>
                        <option value="">None</option>
                        {(selected.matched_drawings ?? []).map((d) => (
                          <option key={d.id} value={d.id}>{d.part_number ?? d.filename}</option>
                        ))}
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ padding: "14px 20px" }}>
              {genError ? (
                <div style={{ marginBottom: 10, background: "#FBEFEF", border: `1px solid ${colors.red}`, borderRadius: 6, padding: "8px 12px", fontSize: 11, color: colors.red }}>
                  {genError}
                </div>
              ) : null}
              <PrimaryButton onClick={handleGenerate} disabled={generate.isPending || lines.length === 0}>
                {generate.isPending ? "Generating…" : "Generate Sales Order + Work Orders"}
              </PrimaryButton>
            </div>
          </>
        )}
      </Card>
    </section>
  );
}

/** Bulk-scan several drawing PDFs at once — for RFQ/order packets that bundle multiple
 * prints in one customer email or upload, rather than the single-PO-plus-attachments flow
 * in ScanPoTab. Shares DrawingScanPanel (and its /drawings/analyze-batch endpoint) with the
 * Quoting page's single-drawing scan. */
function BatchDrawingScanTab() {
  return (
    <section>
      <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 14 }}>
        Select or drop several customer drawing PDFs at once — each is scanned independently for finish
        callouts, governing specs, and surface area, the same as the single-drawing scan on the Quoting page.
        Useful when a customer sends a whole packet of prints for one order instead of a single PO PDF.
      </div>
      <DrawingScanPanel />
    </section>
  );
}

export function SalesOrdersPage() {
  const [tab, setTab] = useState<Tab>("orders");

  return (
    <section>
      <div style={{ display: "flex", gap: 8, marginBottom: 18, borderBottom: `1px solid ${colors.rowBorder}` }}>
        {([
          ["orders", "Orders"],
          ["scan", "Scan Purchase Order"],
          ["batch-scan", "Batch Drawing Scan"],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: 600,
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${tab === key ? colors.accentDefault : "transparent"}`,
              color: tab === key ? colors.accentDefault : colors.textMuted,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "orders" ? <OrdersTab /> : tab === "scan" ? <ScanPoTab /> : <BatchDrawingScanTab />}
    </section>
  );
}
