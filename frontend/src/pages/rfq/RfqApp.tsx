import { useRef, useState } from "react";
import {
  useAnalyzeDrawingsBatch,
  useAnalyzePo,
  useDrawingAiStatus,
  useDrawingAnalyses,
  useEmailIntakeLog,
  useEmailIntakeStatus,
  usePoAnalyses,
  usePoStatus,
  usePollEmailIntakeNow,
} from "../../lib/queries";
import { useAuth } from "../../context/AuthContext";
import type { DrawingAnalysis, DrawingBatchResult, EmailIntakeLogEntry, PurchaseOrderAnalysis } from "../../lib/types";
import { RatesTable } from "./RatesTable";

/** Emails → RFQs → surface area, on one screen.
 *
 *  Every endpoint behind this already existed; this page is the interface over
 *  them. Nothing here is fixture data — empty panels mean the pipeline has
 *  produced nothing yet, which is the honest state to show. */

const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const SANS = "'IBM Plex Sans',system-ui,sans-serif";
const INK = "#16161A";
const BODY = "#4A4A52";
const MUTED = "#6B6B72";
const FAINT = "#9A9AA2";
const LINE = "#E1E1E4";
const WASH = "#F4F4F5";
const GOLD = "#9A6B00";
const RED = "#B3261E";
const GREEN = "#1E6B4E";

function fmt(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Chip({ text, tone }: { text: string; tone: "ok" | "warn" | "bad" | "grey" }) {
  const tones = {
    ok: { c: GREEN, bg: "#EFF7F3", b: "#C9E3D8" },
    warn: { c: GOLD, bg: "#FAF6EC", b: "#EADFC4" },
    bad: { c: RED, bg: "#FFF1F0", b: "#F0CFCB" },
    grey: { c: MUTED, bg: WASH, b: LINE },
  }[tone];
  return (
    <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.06em", padding: "2px 7px", borderRadius: 3, color: tones.c, background: tones.bg, border: `1px solid ${tones.b}`, whiteSpace: "nowrap" }}>
      {text}
    </span>
  );
}

function Panel({ title, sub, action, children }: { title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ background: "#FFFFFF", border: `1px solid ${LINE}`, borderRadius: 5, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: `1px solid ${LINE}` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: INK }}>{title}</div>
          {sub ? <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, marginTop: 2 }}>{sub}</div> : null}
        </div>
        {action}
      </header>
      <div style={{ overflow: "auto", flex: 1, minHeight: 0 }}>{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "18px 16px", fontFamily: MONO, fontSize: 10.5, color: FAINT, lineHeight: 1.6 }}>{children}</div>;
}

const TH: React.CSSProperties = { fontFamily: MONO, fontSize: 9, letterSpacing: "0.1em", color: FAINT, textAlign: "left", padding: "8px 14px", borderBottom: `1px solid ${LINE}`, whiteSpace: "nowrap", position: "sticky", top: 0, background: "#FFFFFF" };
const TD: React.CSSProperties = { padding: "8px 14px", borderBottom: "1px solid #F0F0F2", verticalAlign: "top" };

function Btn({ children, onClick, disabled, tone = "outline" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; tone?: "primary" | "outline" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: MONO, fontSize: 10, letterSpacing: "0.04em", padding: "5px 11px", borderRadius: 3,
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1,
        background: tone === "primary" ? INK : "#FFFFFF",
        color: tone === "primary" ? "#FFFFFF" : BODY,
        border: `1px solid ${tone === "primary" ? INK : LINE}`,
      }}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ emails */

function Emails() {
  const { data: status } = useEmailIntakeStatus();
  const { data: log, isLoading } = useEmailIntakeLog();
  const poll = usePollEmailIntakeNow();

  const sub = status
    ? status.configured
      ? `${status.imap_host} · ${status.imap_folder} · every ${status.poll_interval_minutes}m · last ${fmt(status.last_poll_at)}`
      : "not configured"
    : "";

  return (
    <Panel
      title="Emails"
      sub={sub}
      action={
        <Btn onClick={() => poll.mutate()} disabled={!status?.configured || poll.isPending}>
          {poll.isPending ? "POLLING…" : "POLL NOW"}
        </Btn>
      }
    >
      {status && !status.configured ? (
        <Empty>
          IMAP is not configured, so nothing is being pulled.
          <br />
          Set <span style={{ color: BODY }}>IMAP_HOST</span>, <span style={{ color: BODY }}>IMAP_USERNAME</span>,{" "}
          <span style={{ color: BODY }}>IMAP_PASSWORD</span> and <span style={{ color: BODY }}>IMAP_ALLOWED_SENDERS</span> in{" "}
          <span style={{ color: BODY }}>backend/.env</span>, then restart the backend.
        </Empty>
      ) : null}
      {status?.last_error ? (
        <div style={{ margin: "10px 14px", padding: "8px 11px", borderRadius: 4, background: "#FFF8F7", border: "1px solid #F5DEDB", fontFamily: MONO, fontSize: 10, color: RED, lineHeight: 1.5 }}>
          Last poll error ({fmt(status.last_error_at)}): {status.last_error}
        </div>
      ) : null}
      {isLoading ? (
        <Empty>Loading…</Empty>
      ) : !log?.length ? (
        <Empty>No messages processed yet.</Empty>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={TH}>FROM</th>
              <th style={TH}>SUBJECT</th>
              <th style={TH}>ATTACHMENT</th>
              <th style={TH}>STATUS</th>
              <th style={TH}>WHEN</th>
            </tr>
          </thead>
          <tbody>
            {log.map((m: EmailIntakeLogEntry) => (
              <tr key={m.id}>
                <td style={{ ...TD, fontFamily: MONO, fontSize: 10.5, color: BODY }}>{m.sender}</td>
                <td style={{ ...TD, fontFamily: SANS, fontSize: 12, color: INK }}>
                  {m.subject || "(no subject)"}
                  {m.error_detail ? <div style={{ fontFamily: MONO, fontSize: 9.5, color: RED, marginTop: 3 }}>{m.error_detail}</div> : null}
                </td>
                <td style={{ ...TD, fontFamily: MONO, fontSize: 10, color: MUTED }}>{m.attachment_filename ?? "—"}</td>
                <td style={TD}>
                  <Chip text={m.status.toLowerCase()} tone={m.status === "Scanned" ? "ok" : m.status === "Error" ? "bad" : "grey"} />
                </td>
                <td style={{ ...TD, fontFamily: MONO, fontSize: 10, color: MUTED, whiteSpace: "nowrap" }}>{fmt(m.processed_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------------- RFQs */

function Rfqs() {
  const { data: pos, isLoading } = usePoAnalyses();
  const { data: poAi } = usePoStatus();
  const analyzePo = useAnalyzePo();
  const poRef = useRef<HTMLInputElement>(null);
  const dwgRef = useRef<HTMLInputElement>(null);
  const [poFile, setPoFile] = useState<File | null>(null);
  const [poErr, setPoErr] = useState<string | null>(null);

  /** The PO is scanned together with its drawings in one call, so the drawings
   *  are matched to their lines by part number server-side. Picking the PO
   *  arms the drawing picker rather than sending immediately. */
  async function sendPo(drawingFiles: File[]) {
    if (!poFile) return;
    setPoErr(null);
    try {
      await analyzePo.mutateAsync({ poFile, drawingFiles });
      setPoFile(null);
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setPoErr(detail ?? "PO scan failed.");
    }
  }

  return (
    <Panel
      title="RFQs"
      sub={poAi ? (poAi.configured ? "purchase orders read by the scanner" : "AI not configured") : ""}
      action={
        <Btn tone="primary" onClick={() => poRef.current?.click()} disabled={!poAi?.configured || analyzePo.isPending}>
          {analyzePo.isPending ? "SCANNING…" : "SCAN PO"}
        </Btn>
      }
    >
      <input
        ref={poRef}
        type="file"
        accept="application/pdf"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          e.target.value = "";
          if (!f) return;
          setPoFile(f);
          dwgRef.current?.click();
        }}
      />
      <input
        ref={dwgRef}
        type="file"
        accept="application/pdf"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void sendPo(files);
        }}
      />

      {poFile && analyzePo.isPending ? (
        <div style={{ margin: "10px 14px", padding: "8px 11px", borderRadius: 4, background: "#FDFBF5", border: "1px solid #EDE5D2", fontFamily: MONO, fontSize: 10, color: GOLD }}>
          Scanning {poFile.name} and its drawings — vision analysis can take a couple of minutes.
        </div>
      ) : null}
      {poErr ? (
        <div style={{ margin: "10px 14px", padding: "8px 11px", borderRadius: 4, background: "#FFF8F7", border: "1px solid #F5DEDB", fontFamily: MONO, fontSize: 10, color: RED }}>{poErr}</div>
      ) : null}

      {isLoading ? (
        <Empty>Loading…</Empty>
      ) : !pos?.length ? (
        <Empty>No purchase orders scanned yet. SCAN PO takes the PO first, then its drawings — they are read together so each drawing matches its line by part number.</Empty>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={TH}>PO</th>
              <th style={TH}>CUSTOMER</th>
              <th style={TH}>LINES</th>
              <th style={TH}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {pos.map((p: PurchaseOrderAnalysis) => (
              <tr key={p.id}>
                <td style={{ ...TD, fontFamily: MONO, fontSize: 11, fontWeight: 600, color: INK, whiteSpace: "nowrap" }}>
                  {p.po_number ?? p.filename}
                  <div style={{ fontFamily: MONO, fontSize: 9.5, color: FAINT, fontWeight: 400, marginTop: 2 }}>{p.po_date ?? fmt(p.created_at)}</div>
                </td>
                <td style={{ ...TD, fontFamily: SANS, fontSize: 12, color: BODY }}>{p.customer_name_guess ?? "—"}</td>
                <td style={TD}>
                  {!p.line_items?.length ? (
                    <span style={{ fontFamily: MONO, fontSize: 10, color: FAINT }}>—</span>
                  ) : (
                    p.line_items.map((l) => (
                      <div key={l.line_no} style={{ fontFamily: MONO, fontSize: 10.5, color: BODY, marginBottom: 3 }}>
                        <span style={{ color: INK, fontWeight: 600 }}>{l.part_number ?? "?"}</span>
                        {l.revision ? ` rev ${l.revision}` : ""} · {l.qty ?? "?"} ea
                        {l.spec_text ? <span style={{ color: MUTED }}> · {l.spec_text}</span> : null}
                      </div>
                    ))
                  )}
                </td>
                <td style={TD}>
                  <Chip text={p.status.toLowerCase()} tone={p.status === "Error" ? "bad" : "ok"} />
                  {p.error_detail ? <div style={{ fontFamily: MONO, fontSize: 9.5, color: RED, marginTop: 4 }}>{p.error_detail}</div> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------ surface area */

const RATE_KEY = "tpp.rfq.ratePerSqIn";
const MIN_KEY = "tpp.rfq.lotMinimum";

function loadNum(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function SurfaceArea() {
  const { data: ai } = useDrawingAiStatus();
  const { data: drawings, isLoading } = useDrawingAnalyses();
  const analyze = useAnalyzeDrawingsBatch();
  const inputRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<DrawingBatchResult[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  /** Rate and lot minimum are yours to set — no rate card exists in this codebase
   *  and none is invented here. Kept per-browser so they survive a reload. */
  const [rate, setRate] = useState(() => loadNum(RATE_KEY));
  const [lotMin, setLotMin] = useState(() => loadNum(MIN_KEY));

  function persist(key: string, v: string, set: (s: string) => void) {
    set(v);
    try {
      window.localStorage.setItem(key, v);
    } catch {
      /* private browsing — the value still applies for this session */
    }
  }

  const rateNum = parseFloat(rate);
  const minNum = parseFloat(lotMin);

  /** area x rate, floored at the lot minimum. Returns null when there is nothing
   *  to compute from, so the column reads "—" rather than a misleading $0.00. */
  function priceOf(area: number | null): { value: number; floored: boolean } | null {
    if (area == null || !Number.isFinite(rateNum) || rateNum <= 0) return null;
    const raw = area * rateNum;
    if (Number.isFinite(minNum) && minNum > 0 && raw < minNum) return { value: minNum, floored: true };
    return { value: raw, floored: false };
  }

  async function send(files: File[]) {
    if (!files.length) return;
    setErr(null);
    setResults(null);
    try {
      setResults(await analyze.mutateAsync(files));
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErr(detail ?? "Scan failed.");
    }
  }

  const rows: DrawingAnalysis[] = results
    ? (results.filter((r) => r.analysis).map((r) => r.analysis) as DrawingAnalysis[])
    : (drawings ?? []);

  return (
    <Panel
      title="Surface area"
      sub={ai ? (ai.configured ? `drawing scan · ${ai.model}` : "AI not configured") : ""}
      action={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.1em", color: FAINT }}>$/IN²</label>
          <input
            value={rate}
            onChange={(e) => persist(RATE_KEY, e.target.value.replace(/[^0-9.]/g, ""), setRate)}
            placeholder="0.00"
            style={{ width: 62, fontFamily: MONO, fontSize: 11, textAlign: "right", color: INK, border: `1px solid ${LINE}`, borderRadius: 3, padding: "4px 6px", outline: "none" }}
          />
          <label style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.1em", color: FAINT }}>LOT MIN</label>
          <input
            value={lotMin}
            onChange={(e) => persist(MIN_KEY, e.target.value.replace(/[^0-9.]/g, ""), setLotMin)}
            placeholder="0.00"
            style={{ width: 62, fontFamily: MONO, fontSize: 11, textAlign: "right", color: INK, border: `1px solid ${LINE}`, borderRadius: 3, padding: "4px 6px", outline: "none" }}
          />
          <Btn tone="primary" onClick={() => inputRef.current?.click()} disabled={!ai?.configured || analyze.isPending}>
            {analyze.isPending ? "SCANNING…" : "SCAN DRAWINGS"}
          </Btn>
        </div>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          void send(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      {ai && !ai.configured ? (
        <Empty>
          No <span style={{ color: BODY }}>ANTHROPIC_API_KEY</span> in <span style={{ color: BODY }}>backend/.env</span>, so scanning returns 503.
          <br />
          Set it and restart the backend — the whole extraction path is already built.
        </Empty>
      ) : null}

      {err ? (
        <div style={{ margin: "10px 14px", padding: "8px 11px", borderRadius: 4, background: "#FFF8F7", border: "1px solid #F5DEDB", fontFamily: MONO, fontSize: 10, color: RED }}>{err}</div>
      ) : null}

      {results?.some((r) => !r.success) ? (
        <div style={{ margin: "10px 14px", padding: "8px 11px", borderRadius: 4, background: "#FDFBF5", border: "1px solid #EDE5D2", fontFamily: MONO, fontSize: 10, color: GOLD, lineHeight: 1.5 }}>
          {results.filter((r) => !r.success).map((r) => <div key={r.filename}>{r.filename}: {r.error}</div>)}
        </div>
      ) : null}

      {isLoading ? (
        <Empty>Loading…</Empty>
      ) : !rows.length ? (
        <Empty>No drawings scanned yet. Use SCAN DRAWINGS to read surface area off a print.</Empty>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={TH}>PART</th>
              <th style={TH}>MATERIAL</th>
              <th style={{ ...TH, textAlign: "right" }}>AREA (IN²)</th>
              <th style={{ ...TH, textAlign: "right" }}>PRICE</th>
              <th style={TH}>METHOD</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td style={{ ...TD, whiteSpace: "nowrap" }}>
                  <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: INK }}>
                    {d.part_number ?? d.filename}
                    {d.revision ? <span style={{ fontWeight: 400, color: MUTED }}> rev {d.revision}</span> : null}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 9.5, color: FAINT, marginTop: 2 }}>{d.filename}</div>
                </td>
                <td style={{ ...TD, fontFamily: MONO, fontSize: 10.5, color: BODY }}>{d.material ?? "—"}</td>
                <td style={{ ...TD, textAlign: "right", whiteSpace: "nowrap" }}>
                  <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: d.surface_area_sq_in == null ? FAINT : INK }}>
                    {d.surface_area_sq_in == null ? "—" : d.surface_area_sq_in.toFixed(3)}
                  </span>
                  {d.surface_area_confidence ? (
                    <div style={{ marginTop: 4 }}>
                      <Chip
                        text={d.surface_area_confidence}
                        tone={d.surface_area_confidence === "high" ? "ok" : d.surface_area_confidence === "medium" ? "warn" : "bad"}
                      />
                    </div>
                  ) : null}
                </td>
                <td style={{ ...TD, textAlign: "right", whiteSpace: "nowrap" }}>
                  {(() => {
                    const p = priceOf(d.surface_area_sq_in);
                    if (!p) return <span style={{ fontFamily: MONO, fontSize: 11, color: FAINT }}>—</span>;
                    return (
                      <>
                        <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: INK }}>${p.value.toFixed(2)}</span>
                        {p.floored ? <div style={{ marginTop: 4 }}><Chip text="lot min" tone="warn" /></div> : null}
                      </>
                    );
                  })()}
                </td>
                <td style={{ ...TD, fontFamily: MONO, fontSize: 10, color: MUTED, lineHeight: 1.5 }}>
                  {d.surface_area_method ?? (d.error_detail ? <span style={{ color: RED }}>{d.error_detail}</span> : "—")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

/* --------------------------------------------------------------------- app */

export function RfqApp() {
  const { user, logout } = useAuth();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: WASH, color: INK, fontFamily: SANS, overflow: "hidden" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "0 18px", height: 50, background: INK, color: "#F4F4F5", flexShrink: 0 }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 15, color: "#E8B84B" }}>TPP</span>
        <span style={{ fontSize: 13, fontWeight: 500 }}>RFQ Intake</span>
        <div style={{ width: 1, height: 18, background: "#3A3A40" }} />
        <span style={{ fontFamily: MONO, fontSize: 10, color: "#8C8C94", letterSpacing: "0.05em" }}>emails · rfqs · surface area</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: "#8C8C94" }}>{user?.name}</span>
        <button
          onClick={logout}
          style={{ fontFamily: MONO, fontSize: 10, color: "#8C8C94", background: "transparent", border: "1px solid #3A3A40", borderRadius: 3, padding: "3px 9px", cursor: "pointer" }}
        >
          SIGN OUT
        </button>
      </header>

      <main style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr auto", gap: 12, padding: 12, overflow: "auto" }}>
        <div style={{ gridRow: "1 / 3", minHeight: 0, display: "flex" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Emails />
          </div>
        </div>
        <SurfaceArea />
        <Rfqs />
        <div style={{ gridColumn: "1 / 3", minHeight: 0 }}>
          <RatesTable />
        </div>
      </main>
    </div>
  );
}
