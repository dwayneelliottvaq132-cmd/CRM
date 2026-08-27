import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { sx } from "./sx";
import {
  OCHRE, RED, GREEN, BLUE,
  chip, S, SEV, FLWRAP,
  DOCS, DWG_FOLDERS, DWGS, QUOTE_ROWS, STEPS, MAILS, SPECS, PROCS, BTN, JOBS, ST_STYLE,
} from "./designData";

/** Quoting policy. The design exposes this as an editable prop defaulting to
 *  `this.props.strictGate ?? true` — i.e. the gate is on unless deliberately relaxed. */
const STRICT_GATE = true;

type Screen = "rfq" | "quote" | "queue" | "review" | "inspect" | "drawings" | "specs" | "procs";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
.fc { font-family:'Space Grotesk', system-ui, sans-serif; -webkit-font-smoothing:antialiased; }
.fc a { color:#9A6B00; text-decoration:none; }
.fc a:hover { color:#6E4C00; text-decoration:underline; }
.fc ::-webkit-scrollbar { width:10px; height:10px; }
.fc ::-webkit-scrollbar-thumb { background:#D2D2D6; border-radius:6px; }
.fc-h-f4:hover { background:#F4F4F5 !important; }
.fc-h-fa:hover { background:#FAFAFB !important; }
.fc-h-fc:hover { background:#FCFCFD !important; }
.fc-h-gold:hover { background:#FAF6EC !important; }
.fc-erp-link:hover { color:#E8B84B !important; border-color:#5A4A1E !important; }
.fc-h-bd:hover { border-color:#9A6B00 !important; }
`;

const MONO = "'Space Mono',monospace";
const LBL = `font-family:${MONO}; font-size:9px; letter-spacing:0.08em; color:#9A9AA2`;
const H1 = { margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em" } as const;
const CARD = "background:#FFFFFF; border:1px solid #E1E1E4; border-radius:5px";

/** Rolls a mail's prior-pricing rows up into a single status chip. */
function priceRollup(p?: unknown[][]) {
  if (!p || !p.length) return { label: "no parts to price", key: "grey" };
  const n: Record<string, number> = { current: 0, stale: 0, never: 0 };
  p.forEach((r) => { n[r[3] as string]++; });
  if (n.never) return { label: `${n.never} of ${p.length} never priced`, key: "open" };
  if (n.stale) return { label: `${n.stale} of ${p.length} priced over a year ago`, key: "review" };
  return { label: `all ${p.length} parts have current pricing`, key: "ready" };
}

const KIND: Record<string, string> = {
  PO: chip(BLUE, "#EFF3FB", "#CBD8EF"),
  DWG: chip(OCHRE, "#FAF6EC", "#EADFC4"),
};
const PRICE_KEY: Record<string, string> = { current: "ready", stale: "review", never: "open" };
const CLS: Record<string, { label: string; chip: string }> = {
  itar: { label: "ITAR", chip: chip(RED, "#FFF1F0", "#F0CFCB") },
  cui: { label: "CUI", chip: chip(OCHRE, "#FAF6EC", "#EADFC4") },
  open: { label: "unrestricted", chip: chip("#6B6B72", "#F4F4F5", "#E1E1E4") },
};
const FOLD_NOTE: Record<string, string[]> = {
  all: ["Mixed classification. Export-controlled prints are marked in the class column and must not leave the facility network.", "#E1E1E4", "#FFFFFF", "#6B6B72"],
  itar: ["ITAR — 22 CFR 120–130. Access limited to US persons on the authorized list. No transmission outside the facility network, no subcontracting without an approved TAA.", "#F0CFCB", "#FFF6F5", "#4A4A52"],
  cui: ["CUI//SP-EXPT — handled per 32 CFR 2002 and NIST SP 800-171. Marked on every print and carried onto any derived planning or inspection record.", "#EADFC4", "#FAF6EC", "#4A4A52"],
  open: ["No export or handling restriction recorded on these prints.", "#E1E1E4", "#FFFFFF", "#6B6B72"],
};

/** Stat tile used across Planning development and Quote. */
function Stat({ label, value, color, minWidth = 132 }: { label: string; value: string; color?: string; minWidth?: number }) {
  return (
    <div style={{ ...sx(CARD), padding: "11px 15px", minWidth }}>
      <div style={sx(LBL)}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: color ?? "#16161A", marginTop: 3 }}>{value}</div>
    </div>
  );
}

function PageHead({ title, meta, lede, maxWidth = 680 }: { title: string; meta: string; lede?: string; maxWidth?: number }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginBottom: 4 }}>
        <h1 style={H1}>{title}</h1>
        <span style={{ fontSize: 11, color: "#6B6B72", paddingBottom: 2 }}>{meta}</span>
      </div>
      {lede ? <p style={{ margin: "0 0 16px", fontSize: 12, color: "#6B6B72", maxWidth, textWrap: "pretty" }}>{lede}</p> : null}
    </>
  );
}

export function FinishingControl() {
  const [screen, setScreen] = useState<Screen>("rfq");
  const [docIdx, setDocIdx] = useState(1);
  const [viewer, setViewer] = useState<"po" | "dwg">("po");
  const [mailIdx, setMailIdx] = useState(0);
  const [dwgFolder, setDwgFolder] = useState("all");
  const [fromQuote, setFromQuote] = useState<string | null>(null);

  // The design hard-codes "Doug Gordon" / "DG". Show whoever is actually signed in —
  // RequireAuth guarantees a user here, so the fallbacks only cover a torn-down session.
  const { user } = useAuth();
  const userName = user?.name ?? "—";
  const userInitials = user?.initials ?? "??";

  const go = (s: Screen) => setScreen(s);
  const openDoc = (i: number, from?: string) => {
    setDocIdx(i); setViewer("po"); setFromQuote(from ?? null); setScreen("review");
  };

  const nav = (active: boolean) =>
    `display:flex; align-items:center; justify-content:space-between; gap:8px; width:100%; text-align:left; padding:7px 16px; font-family:inherit; font-size:12.5px; cursor:pointer; border:0; border-left:3px solid ${active ? OCHRE : "transparent"}; background:${active ? "#FAF6EC" : "transparent"}; color:${active ? "#16161A" : "#4A4A52"}; font-weight:${active ? 600 : 400}`;
  const tab = (active: boolean) =>
    `font-family:${MONO}; font-size:10.5px; letter-spacing:0.04em; padding:4px 10px; border-radius:3px; cursor:pointer; border:1px solid ${active ? "#16161A" : "#E1E1E4"}; background:${active ? "#16161A" : "#FFF"}; color:${active ? "#FFF" : "#4A4A52"}`;

  const doc = DOCS[docIdx] || DOCS[0];
  const mail = MAILS[mailIdx] || MAILS[0];
  const mailRoll = priceRollup(mail.pricing as unknown[][]);

  const NAV: [Screen, string, string, string | undefined][] = [
    ["rfq", "RFQ inbox", "3", RED],
    ["quote", "Quote", "10", undefined],
    ["queue", "Planning development", "5", undefined],
    ["inspect", "Traveler & inspection", "1", undefined],
  ];
  const LIB: [Screen, string, string][] = [
    ["drawings", "Drawings", "8"],
    ["specs", "Specifications", "9"],
    ["procs", "Internal procedures", "9"],
  ];

  return (
    <div className="fc" style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#F4F4F5", color: "#16161A", overflow: "hidden" }}>
      <style>{CSS}</style>

      <header style={{ display: "flex", alignItems: "center", gap: 20, padding: "0 18px", height: 52, background: "#16161A", color: "#F4F4F5", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em", color: "#E8B84B" }}>TPP</span>
          <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: "0.01em" }}>Finishing Control</span>
        </div>
        <div style={{ width: 1, height: 20, background: "#3A3A40" }} />
        <div style={{ fontFamily: MONO, fontSize: 10, color: "#8C8C94", letterSpacing: "0.06em" }}>NADCAP AC7108 · AS9100D · CAGE 1KQP3</div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#8C8C94" }}>
          <span style={{ fontFamily: MONO }}>Rate card:</span>
          <span style={{ fontFamily: MONO, color: "#E8B84B", border: "1px solid #5A4A1E", background: "#241E0C", padding: "2px 7px", borderRadius: 3 }}>not loaded</span>
        </div>
        {/* Way out to the ERP. Finishing Control is the landing page, so without
            this the back-office screens would only be reachable by typing a URL. */}
        <Link
          to="/dashboard"
          className="fc-erp-link"
          style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.06em", color: "#8C8C94", textDecoration: "none", border: "1px solid #3A3A40", borderRadius: 3, padding: "3px 9px" }}
        >
          ERP →
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 6, borderLeft: "1px solid #3A3A40" }}>
          <div title={user?.role ?? ""} style={{ width: 22, height: 22, borderRadius: "50%", background: "#9A6B00", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff" }}>{userInitials}</div>
          <span style={{ fontSize: 11 }}>{userName}</span>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <nav style={{ width: 186, flexShrink: 0, background: "#FFFFFF", borderRight: "1px solid #E1E1E4", display: "flex", flexDirection: "column", padding: "10px 0" }}>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", color: "#9A9AA2", padding: "6px 16px 8px" }}>WORKFLOW</div>
          {NAV.map(([key, label, count, color]) => (
            <button key={key} className="fc-h-f4" onClick={() => go(key)} style={sx(nav(screen === key))}>
              <span>{label}</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: color ?? "#6B6B72" }}>{count}</span>
            </button>
          ))}
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", color: "#9A9AA2", padding: "22px 16px 8px" }}>LIBRARY</div>
          {LIB.map(([key, label, count]) => (
            <button key={key} className="fc-h-f4" onClick={() => go(key)} style={sx(nav(screen === key))}>
              <span>{label}</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: "#6B6B72" }}>{count}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ margin: "0 12px", padding: 10, background: "#FAF6EC", border: "1px solid #EADFC4", borderRadius: 4 }}>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em", color: "#9A6B00", marginBottom: 5 }}>SOURCES OF TRUTH</div>
            <div style={{ fontSize: 10, lineHeight: 1.55, color: "#6B6B72" }}>
              FSP-1066 (AFSI part-number / finish table) is <strong style={{ color: RED }}>not on file</strong>. Six lines defer material and finish to it.
            </div>
          </div>
        </nav>

        <main style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
          {screen === "rfq" && <RfqInbox {...{ mailIdx, setMailIdx, mail, mailRoll, go }} />}
          {screen === "queue" && <PlanningDev go={go} />}
          {screen === "review" && (
            <PoReview
              doc={doc} viewer={viewer} setViewer={setViewer} tab={tab}
              backLabel={fromQuote ? `quote ${fromQuote}` : "quote"}
              onBack={() => go("quote")}
              onPrev={() => { setDocIdx((docIdx + DOCS.length - 1) % DOCS.length); setViewer("po"); }}
              onNext={() => { setDocIdx((docIdx + 1) % DOCS.length); setViewer("po"); }}
            />
          )}
          {screen === "quote" && <QuoteView onOpen={openDoc} />}
          {screen === "inspect" && <TravelerView />}
          {screen === "specs" && <SpecsView />}
          {screen === "procs" && <ProcsView />}
          {screen === "drawings" && <DrawingsView fold={dwgFolder} setFold={setDwgFolder} />}
        </main>
      </div>
    </div>
  );
}

/* ─── RFQ inbox ─────────────────────────────────────────────────────────── */

function RfqInbox({ mailIdx, setMailIdx, mail, mailRoll, go }: any) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 32%) 1fr", height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid #E1E1E4", background: "#FFFFFF", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid #E1E1E4", flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, flexShrink: 0 }}>Sales</span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: "#6B6B72", flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Outlook · sales@texasprecision.net</span>
          <span style={sx(S.ready)}>synced 8:04 AM</span>
        </div>
        <div style={{ flex: 1, overflow: "auto" }}>
          {MAILS.map((m: any, i: number) => {
            const roll = priceRollup(m.pricing);
            return (
              <button
                key={i}
                className="fc-h-fa"
                onClick={() => setMailIdx(i)}
                style={sx(`display:block; width:100%; text-align:left; font-family:inherit; padding:11px 14px; border:0; border-bottom:1px solid #F2F2F4; border-left:3px solid ${i === mailIdx ? OCHRE : "transparent"}; background:${i === mailIdx ? "#FAF6EC" : "#FFF"}; cursor:pointer`)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={sx(`width:6px; height:6px; border-radius:50%; flex-shrink:0; background:${m.unread ? OCHRE : "transparent"}`)} />
                  <span style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.from}</span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontFamily: MONO, fontSize: 9.5, color: "#9A9AA2" }}>{m.time}</span>
                </div>
                <div style={{ fontSize: 11.5, marginTop: 3, lineHeight: 1.4, color: "#16161A" }}>{m.subject}</div>
                <div style={{ fontSize: 10.5, marginTop: 3, color: "#6B6B72", lineHeight: 1.45, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.preview}</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: "#6B6B72", background: "#F4F4F5", border: "1px solid #E1E1E4", padding: "2px 6px", borderRadius: 3 }}>
                    {m.attachments.length === 1 ? "1 attachment" : `${m.attachments.length} attachments`}
                  </span>
                  <span style={sx((S as any)[roll.key])}>{roll.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ overflow: "auto", minWidth: 0, background: "#F4F4F5" }}>
        <div style={{ padding: "16px 20px 40px" }}>
          <div style={{ ...sx(CARD), padding: "15px 17px", marginBottom: 14 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.4, textWrap: "pretty" }}>{mail.subject}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 9, flexWrap: "wrap" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#E7E7EA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 700, color: "#4A4A52" }}>{mail.initials}</div>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 500 }}>{mail.from} · {mail.address2}</div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: "#9A9AA2" }}>{mail.address}</div>
              </div>
              <div style={{ flex: 1 }} />
              <span style={{ fontFamily: MONO, fontSize: 10, color: "#6B6B72" }}>{mail.received}</span>
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #EFEFF1", fontSize: 12, lineHeight: 1.65, color: "#3A3A42", whiteSpace: "pre-wrap", textWrap: "pretty" }}>{mail.body}</div>
          </div>

          <div style={{ ...sx(CARD), marginBottom: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 16px", borderBottom: "1px solid #EFEFF1", background: "#FCFCFD" }}>
              <span style={sx(LBL)}>ATTACHMENTS</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: "#6B6B72" }}>{mail.attachments.length} file{mail.attachments.length === 1 ? "" : "s"}</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 10.5, color: "#6B6B72" }}>classified on arrival</span>
            </div>
            {mail.attachments.map((a: any, i: number) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 16px", borderBottom: "1px solid #F2F2F4" }}>
                <span style={sx(KIND[a.kind])}>{a.kind}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: MONO, fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                  <div style={{ fontSize: 10.5, color: "#6B6B72", marginTop: 2, lineHeight: 1.45 }}>{a.detail}</div>
                </div>
                <span style={sx((S as any)[a.parseKey])}>{a.parse}</span>
              </div>
            ))}
          </div>

          {(mail.pricing || []).length > 0 && (
            <div style={{ ...sx(CARD), marginBottom: 14, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 16px", borderBottom: "1px solid #EFEFF1", background: "#FCFCFD" }}>
                <span style={sx(LBL)}>PRIOR PRICING</span>
                <span style={sx((S as any)[mailRoll.key])}>{mailRoll.label}</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 10.5, color: "#6B6B72" }}>matched on part number</span>
              </div>
              {mail.pricing.map((p: any[], i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 16px", borderBottom: "1px solid #F2F2F4" }}>
                  <span style={sx(`width:3px; align-self:stretch; border-radius:2px; background:${p[3] === "current" ? GREEN : p[3] === "stale" ? OCHRE : RED}`)} />
                  <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, minWidth: 118 }}>{p[0]}</span>
                  <span style={sx((S as any)[PRICE_KEY[p[3]]])}>{p[3] === "current" ? "priced" : p[3] === "stale" ? "over a year" : "never priced"}</span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 10.5, color: "#6B6B72" }}>{p[2]}</span>
                  <span style={sx(`font-family:${MONO}; font-size:11.5px; text-align:right; color:${p[3] === "never" ? "#B0B0B8" : "#16161A"}`)}>{p[1]}</span>
                </div>
              ))}
            </div>
          )}

          <div style={sx(`background:#FFFFFF; border:1px solid ${mailRoll.key === "open" ? "#F0CFCB" : "#E1E1E4"}; border-radius:5px; padding:13px 16px`)}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={sx((S as any)[mailRoll.key])}>{mailRoll.label}</span>
              <span style={{ fontSize: 11.5, color: "#4A4A52" }}>{mail.actionNote}</span>
              <div style={{ flex: 1 }} />
              <button onClick={() => go(mail.goto)} style={sx((BTN as any)[mail.btnKey])}>{mail.btnLabel}</button>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: "#6B6B72", marginTop: 8, lineHeight: 1.55 }}>{mail.actionDetail}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Planning development ──────────────────────────────────────────────── */

function PlanningDev({ go }: { go: (s: Screen) => void }) {
  return (
    <div style={{ padding: "22px 26px 40px" }}>
      <PageHead
        title="Planning development"
        meta="5 jobs · quotes finalized, parts not yet on the dock"
        lede="The window between a finalized quote and the parts arriving is dead time. This work center spends it: an agent drafts planning from the purchase order, the drawing, how the part was run before, and the current process and spec definitions loaded from Steelhead, so contract review and planning are already done when the truck shows up. Conflicts surface now, weeks ahead of the tank, instead of becoming non-conformities later."
        maxWidth={700}
      />

      <div style={{ display: "flex", alignItems: "flex-start", gap: 11, background: "#FFF6F5", border: "1px solid #F0CFCB", borderRadius: 5, padding: "11px 15px", marginBottom: 14 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em", color: RED, paddingTop: 2, flexShrink: 0 }}>PRIORITY</span>
        <div style={{ fontSize: 11.5, color: "#4A4A52", lineHeight: 1.6, textWrap: "pretty" }}>
          Two jobs cannot be planned without the customer. Both are on 8-week material lead times, so the questions have to go out now — <strong>217-113-AH0</strong> needs FSP-1066 to fix the embrittlement bake duration, and <strong>217-104-1HF0</strong> carries a thickness below every B733 grade and a type designation that contradicts its base material.
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "stretch" }}>
        <Stat label="AWAITING REVIEW" value="2" color={OCHRE} minWidth={150} />
        <Stat label="AGENT BLOCKED" value="2" color={RED} minWidth={150} />
        <Stat label="RELEASED" value="1" color={GREEN} minWidth={150} />
        <div style={{ flex: 1, minWidth: 260, ...sx(CARD), padding: "11px 15px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={sx(LBL)}>STEELHEAD SNAPSHOT</div>
            <span style={sx(S.ready)}>synced today</span>
          </div>
          <div style={{ fontSize: 11.5, color: "#4A4A52", lineHeight: 1.5, marginTop: 5 }}>
            DuckDB load 08/26/26 05:12 CT · 214 process definitions, 38 spec revisions, 1,906 historical work orders. Planning drafted against anything older than the current load is flagged for re-check.
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {JOBS.map((j: any, i: number) => (
          <div key={i} style={sx(`background:#FFFFFF; border:1px solid ${j.stateKey === "open" ? "#F0CFCB" : "#E1E1E4"}; border-radius:5px; overflow:hidden`)}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 15px", borderBottom: "1px solid #EFEFF1", background: "#FCFCFD", flexWrap: "wrap" }}>
              <span style={{ fontFamily: MONO, fontSize: 10, color: "#FFF", background: "#16161A", borderRadius: 3, padding: "2px 6px" }}>{j.ref}</span>
              <span style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 700 }}>{j.part}</span>
              <span style={{ fontSize: 11, color: "#6B6B72" }}>{j.proc}</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontFamily: MONO, fontSize: 11, color: "#6B6B72" }}>{j.qty} ea</span>
              <span style={sx((S as any)[j.stateKey])}>{j.state}</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px,1fr))", borderBottom: "1px solid #EFEFF1" }}>
              {j.sources.map((s: any[], k: number) => (
                <div key={k} style={{ padding: "10px 15px", borderRight: "1px solid #F2F2F4" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={sx(`width:5px; height:5px; border-radius:50%; flex-shrink:0; background:${s[3] === "ok" ? GREEN : RED}`)} />
                    <span style={sx(LBL)}>{s[0]}</span>
                  </div>
                  <div style={{ fontSize: 11.5, marginTop: 4, lineHeight: 1.45, color: "#16161A" }}>{s[1]}</div>
                  <div style={{ fontSize: 10.5, color: "#6B6B72", marginTop: 2, lineHeight: 1.45 }}>{s[2]}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: "12px 15px", display: "flex", flexDirection: "column", gap: 9 }}>
              <div style={sx(LBL)}>AGENT DRAFT</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {j.route.map((r: string, k: number) => {
                  const soft = /unpriced|undetermined/.test(r);
                  return (
                    <span key={k} style={sx(`font-family:${MONO}; font-size:9.5px; padding:3px 8px; border-radius:3px; white-space:nowrap; color:${soft ? RED : "#4A4A52"}; background:${soft ? "#FFF1F0" : "#F4F4F5"}; border:1px solid ${soft ? "#F0CFCB" : "#E1E1E4"}`)}>{r}</span>
                  );
                })}
              </div>
              <div style={{ fontSize: 11.5, color: "#4A4A52", lineHeight: 1.6, textWrap: "pretty" }}>{j.note}</div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: "#6B6B72", lineHeight: 1.55, paddingLeft: 9, borderLeft: "2px solid #D2D2D6" }}>{j.basis}</div>
            </div>

            <div style={sx(`display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:11px 15px; border-top:1px solid #EFEFF1; background:${j.stateKey === "open" ? "#FFFAF9" : j.stateKey === "ready" ? "#F7FBF9" : "#FDFBF5"}`)}>
              <span style={{ fontSize: 11.5, color: "#4A4A52" }}>{j.footNote}</span>
              <div style={{ flex: 1 }} />
              <button onClick={() => go(j.goto)} style={sx((BTN as any)[j.btnKey])}>{j.btnLabel}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── PO review (split viewer) ──────────────────────────────────────────── */

function PoReview({ doc, viewer, setViewer, tab, backLabel, onBack, onPrev, onNext }: any) {
  const lines = doc.lines.map((ln: any) => ({
    ...ln,
    priceState: STRICT_GATE ? ln.priceState : ln.priceKey === "open" ? "price with exceptions" : ln.priceState,
  }));
  const src = (viewer === "po" ? doc.po : doc.dwg) + "#view=Fit&toolbar=0";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(360px, 44%) 1fr", height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid #E1E1E4", background: "#E7E7EA", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "#FFFFFF", borderBottom: "1px solid #E1E1E4", flexShrink: 0 }}>
          <button onClick={() => setViewer("po")} style={sx(tab(viewer === "po"))}>Purchase order</button>
          <button onClick={() => setViewer("dwg")} style={sx(tab(viewer === "dwg"))}>Drawing</button>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: MONO, fontSize: 10, color: "#6B6B72" }}>{viewer === "po" ? `PO ${doc.no}` : doc.dwgLabel}</span>
        </div>
        <iframe src={`/finishing/${src}`} title="document" style={{ flex: 1, width: "100%", border: 0, background: "#E7E7EA" }} />
      </div>

      <div style={{ overflow: "auto", minWidth: 0, background: "#F4F4F5" }}>
        <div style={{ padding: "16px 20px 40px" }}>
          <div style={{ ...sx(CARD), padding: "14px 16px", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <button className="fc-h-bd" onClick={onBack} style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.04em", background: "#FFF", border: "1px solid #E1E1E4", borderRadius: 3, padding: "4px 10px", cursor: "pointer", color: "#4A4A52" }}>← {backLabel}</button>
              <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700 }}>{doc.no}</span>
              <span style={sx((S as any)[doc.statusKey])}>{doc.status}</span>
              <div style={{ flex: 1 }} />
              <button className="fc-h-bd" onClick={onPrev} style={{ fontFamily: MONO, fontSize: 11, background: "#FFF", border: "1px solid #E1E1E4", borderRadius: 3, padding: "3px 9px", cursor: "pointer" }}>←</button>
              <button className="fc-h-bd" onClick={onNext} style={{ fontFamily: MONO, fontSize: 11, background: "#FFF", border: "1px solid #E1E1E4", borderRadius: 3, padding: "3px 9px", cursor: "pointer" }}>→</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: "10px 18px" }}>
              {doc.header.map((h: any, i: number) => (
                <div key={i}>
                  <div style={{ ...sx(LBL), marginBottom: 3 }}>{h.k}</div>
                  <div style={{ fontSize: 11.5, lineHeight: 1.4 }}>{h.v}</div>
                </div>
              ))}
            </div>
          </div>

          {lines.map((ln: any, i: number) => (
            <div key={i} style={{ ...sx(CARD), marginBottom: 14, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderBottom: "1px solid #EFEFF1", background: "#FCFCFD" }}>
                <span style={{ fontFamily: MONO, fontSize: 10, color: "#FFF", background: "#16161A", borderRadius: 3, padding: "2px 6px" }}>LN {ln.no}</span>
                <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }}>{ln.part}</span>
                <span style={{ fontSize: 11, color: "#6B6B72" }}>{ln.desc}</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontFamily: MONO, fontSize: 12 }}>{ln.qty} ea</span>
                <span style={{ fontFamily: MONO, fontSize: 12, color: "#6B6B72" }}>{ln.unit}</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(148px,1fr))", gap: "12px 20px", padding: "14px 16px" }}>
                {ln.fields.map((fl: any, k: number) => (
                  <div key={k}>
                    <div style={{ ...sx(LBL), marginBottom: 3 }}>{fl.k}</div>
                    <div style={sx(fl.style)}>{fl.v}</div>
                    <div style={{ fontSize: 10, color: "#9A9AA2", marginTop: 2, lineHeight: 1.4 }}>{fl.sub}</div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: "1px solid #EFEFF1", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={sx(LBL)}>CHECKS</div>
                {ln.flags.map((fl: any, k: number) => (
                  <div key={k} style={sx((FLWRAP as any)[fl.sev])}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={sx((SEV as any)[fl.sev])}>{fl.sev}</span>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{fl.title}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#4A4A52", lineHeight: 1.55, marginTop: 4 }}>{fl.detail}</div>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: "#6B6B72", marginTop: 5, paddingLeft: 9, borderLeft: "2px solid #D2D2D6" }}>{fl.source}</div>
                  </div>
                ))}
              </div>

              <div style={sx(`border-top:1px solid #EFEFF1; padding:12px 16px; background:${ln.priceKey === "ready" ? "#F7FBF9" : ln.priceKey === "info" ? "#F8FAFD" : "#FDFAF9"}`)}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={sx((S as any)[ln.priceKey])}>{ln.priceState}</span>
                  <span style={{ fontSize: 11.5, color: "#4A4A52" }}>{ln.priceNote}</span>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: "#6B6B72", marginTop: 6 }}>{ln.openList}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Quote ─────────────────────────────────────────────────────────────── */

const QCOLS = "92px 74px 132px minmax(180px,1fr) 58px 78px 84px 74px 84px 190px";

function QuoteView({ onOpen }: { onOpen: (i: number, from?: string) => void }) {
  return (
    <div style={{ padding: "22px 26px 40px" }}>
      <PageHead
        title="Quote"
        meta="11 quoted lines · one raised against parts received without a purchase order"
        lede="A line prices only when every quoting input is resolved. Where the rate card has no published row, the line is routed rather than interpolated."
        maxWidth={660}
      />

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <Stat label="READY TO PRICE" value="1" color={GREEN} />
        <Stat label="BLOCKED" value="9" color={RED} />
        <Stat label="OPEN INPUTS" value="21" />
        <div style={{ flex: 1, minWidth: 240, background: "#FAF6EC", border: "1px solid #EADFC4", borderRadius: 5, padding: "11px 15px" }}>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em", color: OCHRE }}>RATE CARD</div>
          <div style={{ fontSize: 11.5, color: "#4A4A52", lineHeight: 1.5, marginTop: 4 }}>
            No TPP rate card is loaded, so no draft prices are computed. The <strong>PO unit price</strong> column below is the price the customer already has on the order — use it to check the order against your card, not as a quote.
          </div>
        </div>
      </div>

      <div style={{ ...sx(CARD), overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: QCOLS, minWidth: 1010, background: "#FCFCFD", borderBottom: "1px solid #E1E1E4", fontFamily: MONO, fontSize: 9, letterSpacing: "0.07em", color: "#9A9AA2" }}>
          {["QUOTE", "PO", "PART", "PROCESS · SPEC"].map((h) => <div key={h} style={{ padding: "9px 10px" }}>{h}</div>)}
          <div style={{ padding: "9px 10px", textAlign: "right" }}>QTY</div>
          <div style={{ padding: "9px 10px", textAlign: "right" }}>AREA IN²</div>
          <div style={{ padding: "9px 10px" }}>BASIS</div>
          <div style={{ padding: "9px 10px", textAlign: "right" }}>PO UNIT</div>
          <div style={{ padding: "9px 10px", textAlign: "right" }}>EXTENDED</div>
          <div style={{ padding: "9px 10px" }}>STATUS</div>
        </div>
        {QUOTE_ROWS.map((r: any[], i: number) => {
          const target = r[11] as number | null;
          return (
            <div
              key={i}
              className="fc-h-gold"
              onClick={target == null ? undefined : () => onOpen(target, r[0] as string)}
              style={sx(`display:grid; grid-template-columns:${QCOLS}; min-width:1010px; border-bottom:1px solid #F2F2F4; font-size:11px; align-items:center; cursor:${target == null ? "default" : "pointer"}`)}
            >
              <div style={{ padding: "9px 10px", fontFamily: MONO, fontWeight: 700 }}>{r[0]}</div>
              <div style={sx(`padding:9px 10px; font-family:${MONO}; font-size:${r[1] ? "11px" : "10px"}; color:${r[1] ? "#6B6B72" : "#B0B0B8"}`)}>{r[1] || "n/a"}</div>
              <div style={{ padding: "9px 10px", fontFamily: MONO, fontWeight: 700 }}>{r[2]}</div>
              <div style={{ padding: "9px 10px", lineHeight: 1.45 }}>{r[3]}</div>
              <div style={{ padding: "9px 10px", fontFamily: MONO, textAlign: "right" }}>{r[4]}</div>
              <div style={sx(`padding:9px 10px; font-family:${MONO}; text-align:right; font-size:${r[5] ? "11px" : "10px"}; color:${r[5] ? "#16161A" : RED}`)}>{r[5] || "not stated"}</div>
              <div style={{ padding: "9px 10px", fontFamily: MONO, fontSize: 10, color: "#6B6B72" }}>{r[6]}</div>
              <div style={{ padding: "9px 10px", fontFamily: MONO, textAlign: "right" }}>{r[7]}</div>
              <div style={{ padding: "9px 10px", fontFamily: MONO, textAlign: "right" }}>{r[8]}</div>
              <div style={{ padding: "7px 10px" }}>
                <span style={sx((S as any)[r[9] === "ready" ? "ready" : r[9] === "info" ? "info" : "open"])}>{r[10]}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: "#6B6B72", lineHeight: 1.6, maxWidth: 720, textWrap: "pretty" }}>
        Surface areas are read off the print where the drawing states one, and estimated from the envelope where it does not — estimated figures are marked. Nothing here is a quote until a human signs it.
      </div>
    </div>
  );
}

/* ─── Traveler & inspection ─────────────────────────────────────────────── */

function TravelerView() {
  return (
    <div style={{ padding: "22px 26px 40px", maxWidth: 1040 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginBottom: 4 }}>
        <h1 style={H1}>Traveler</h1>
        <span style={{ fontFamily: MONO, fontSize: 12, color: "#6B6B72", paddingBottom: 2 }}>PO 243877 · LN 3 · 217-117-BL0</span>
      </div>
      <p style={{ margin: "0 0 18px", fontSize: 12, color: "#6B6B72", maxWidth: 640, textWrap: "pretty" }}>
        Built from the drawing, not typed by hand. Steps unlock in sequence; a step whose requirement is still open cannot be signed.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ ...sx(CARD), padding: "12px 15px", flex: 1, minWidth: 200 }}>
          <div style={{ ...sx(LBL), marginBottom: 5 }}>GOVERNING DOCUMENTS</div>
          <div style={{ fontSize: 11.5, lineHeight: 1.6 }}>
            Drawing 217-117 rev C · PO rev C <span style={{ color: GREEN, fontWeight: 600 }}>match</span><br />
            MIL-A-8625F Type III Class 2, black<br />
            AFSI clause guide Form 4-4.4-87 rev H
          </div>
        </div>
        <div style={{ background: "#FFF6F5", border: "1px solid #F0CFCB", borderRadius: 5, padding: "12px 15px", flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em", color: RED, marginBottom: 5 }}>HOLD</div>
          <div style={{ fontSize: 11.5, lineHeight: 1.6, color: "#4A4A52" }}>
            Lot quantities on the PO sum to <strong>230</strong> against an order of <strong>320</strong>. 90 pieces are unassigned to a lot. Receiving cannot sign until this is reconciled.
          </div>
        </div>
      </div>

      <div style={{ ...sx(CARD), overflow: "hidden" }}>
        {STEPS.map((s: any, i: number) => {
          const k = (ST_STYLE as any)[s.state];
          return (
            <div key={i} style={sx(`display:flex; gap:13px; align-items:flex-start; padding:13px 16px; border-bottom:1px solid #F2F2F4; background:${s.state === "blocked" ? "#FFFAF9" : "#FFF"}; opacity:${s.state === "locked" ? 0.62 : 1}`)}>
              <div style={sx(`flex-shrink:0; width:24px; height:24px; border-radius:4px; display:flex; align-items:center; justify-content:center; font-family:${MONO}; font-size:10px; font-weight:700; color:#FFF; background:${k.badge}`)}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12.5, fontWeight: s.state === "locked" ? 400 : 600 }}>{s.title}</span>
                  <span style={sx(k.chip)}>{k.label}</span>
                </div>
                <div style={{ fontSize: 11, color: "#6B6B72", lineHeight: 1.55, marginTop: 4 }}>{s.detail}</div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: "#9A9AA2", marginTop: 5 }}>{s.ref}</div>
              </div>
              <button
                disabled={s.state === "locked"}
                style={sx(`flex-shrink:0; font-family:${MONO}; font-size:10px; letter-spacing:0.04em; padding:5px 11px; border-radius:3px; border:1px solid ${s.state === "blocked" ? RED : "#E1E1E4"}; background:${s.state === "blocked" ? RED : "#FFF"}; color:${s.state === "blocked" ? "#FFF" : s.state === "locked" ? "#B0B0B8" : "#4A4A52"}; cursor:${s.state === "locked" ? "not-allowed" : "pointer"}`)}
              >
                {k.btn}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Library: specifications / procedures / drawings ───────────────────── */

const SPEC_COLS = "150px 80px minmax(190px,1fr) 116px minmax(210px,1.2fr)";
const PROC_COLS = "118px 62px minmax(200px,1fr) 108px minmax(180px,1fr)";
const DWG_COLS = "112px 48px 92px minmax(170px,1fr) 96px minmax(220px,1.3fr)";

function HeadRow({ cols, minWidth, labels }: { cols: string; minWidth: number; labels: string[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: cols, minWidth, background: "#FCFCFD", borderBottom: "1px solid #E1E1E4", fontFamily: MONO, fontSize: 9, letterSpacing: "0.07em", color: "#9A9AA2" }}>
      {labels.map((l) => (
        <div key={l} style={{ padding: "9px 12px", textAlign: l === "AREA IN²" ? "right" : "left" }}>{l}</div>
      ))}
    </div>
  );
}

function SpecsView() {
  return (
    <div style={{ padding: "22px 26px 40px" }}>
      <PageHead
        title="Specifications"
        meta="9 documents · every spec called by a live order or print"
        lede="Revision levels are checked against the Steelhead load each morning. A spec called by an order that is not held here, or held at a superseded revision, blocks planning rather than being assumed current."
      />
      <div style={{ ...sx(CARD), overflowX: "auto" }}>
        <HeadRow cols={SPEC_COLS} minWidth={880} labels={["SPECIFICATION", "REV", "SCOPE", "STATUS", "CALLED BY"]} />
        {SPECS.map((s: any[], i: number) => (
          <div key={i} className="fc-h-fc" style={{ display: "grid", gridTemplateColumns: SPEC_COLS, minWidth: 880, borderBottom: "1px solid #F2F2F4", fontSize: 11, alignItems: "center" }}>
            <div style={{ padding: "10px 12px", fontFamily: MONO, fontWeight: 700 }}>{s[0]}</div>
            <div style={{ padding: "10px 12px", fontFamily: MONO, color: "#6B6B72" }}>{s[1]}</div>
            <div style={{ padding: "10px 12px", color: "#4A4A52", lineHeight: 1.5 }}>{s[2]}</div>
            <div style={{ padding: "8px 12px" }}><span style={sx((S as any)[s[4]])}>{s[3]}</span></div>
            <div style={{ padding: "10px 12px", color: "#6B6B72", lineHeight: 1.5 }}>{s[5]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProcsView() {
  return (
    <div style={{ padding: "22px 26px 40px" }}>
      <PageHead
        title="Internal procedures"
        meta="9 controlled documents · AS9100D and NADCAP AC7108"
        lede="Each traveler step cites the procedure it runs under. When a procedure is revised, every job planned against the old revision is listed here so the planning can be re-checked before the parts run."
      />
      <div style={{ ...sx(CARD), overflowX: "auto" }}>
        <HeadRow cols={PROC_COLS} minWidth={860} labels={["DOCUMENT", "REV", "TITLE", "LAST REVIEW", "USED BY"]} />
        {PROCS.map((p: any[], i: number) => (
          <div key={i} className="fc-h-fc" style={{ display: "grid", gridTemplateColumns: PROC_COLS, minWidth: 860, borderBottom: "1px solid #F2F2F4", fontSize: 11, alignItems: "center" }}>
            <div style={{ padding: "10px 12px", fontFamily: MONO, fontWeight: 700 }}>{p[0]}</div>
            <div style={{ padding: "10px 12px", fontFamily: MONO, color: "#6B6B72" }}>{p[1]}</div>
            <div style={{ padding: "10px 12px", color: "#4A4A52", lineHeight: 1.5 }}>{p[2]}</div>
            <div style={sx(`padding:10px 12px; font-family:${MONO}; font-size:11px; color:${p[4] === "stale" ? RED : "#6B6B72"}`)}>{p[3]}</div>
            <div style={{ padding: "10px 12px", color: "#6B6B72", lineHeight: 1.5 }}>{p[5]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DrawingsView({ fold, setFold }: { fold: string; setFold: (k: string) => void }) {
  const fn = FOLD_NOTE[fold];
  const rows = DWGS.filter((w: any) => fold === "all" || w.cls === fold);
  return (
    <div style={{ padding: "22px 26px 40px" }}>
      <PageHead
        title="Drawing library"
        meta="8 prints parsed · notes and printed areas harvested"
        lede="Where a print states a plating surface area, it is taken as given. Where it does not, area is estimated from the envelope and marked low confidence."
        maxWidth={640}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12, flexWrap: "wrap" }}>
        {DWG_FOLDERS.map((f: any) => {
          const count = f.key === "all" ? DWGS.length : DWGS.filter((w: any) => w.cls === f.key).length;
          return (
            <button key={f.key} onClick={() => setFold(f.key)} style={sx(`font-family:${MONO}; font-size:10.5px; letter-spacing:0.03em; padding:5px 11px; border-radius:3px; cursor:pointer; border:1px solid ${fold === f.key ? "#16161A" : "#E1E1E4"}; background:${fold === f.key ? "#16161A" : "#FFF"}; color:${fold === f.key ? "#FFF" : "#4A4A52"}`)}>
              {f.label} <span style={{ opacity: 0.6 }}>{count}</span>
            </button>
          );
        })}
      </div>

      <div style={sx(`font-size:11.5px; line-height:1.6; color:${fn[3]}; background:${fn[2]}; border:1px solid ${fn[1]}; border-radius:5px; padding:10px 14px; margin-bottom:14px; text-wrap:pretty`)}>{fn[0]}</div>

      <div style={{ ...sx(CARD), overflowX: "auto" }}>
        <HeadRow cols={DWG_COLS} minWidth={900} labels={["DRAWING", "REV", "CLASS", "TITLE", "AREA IN²", "FINISHING NOTES ON PRINT"]} />
        {rows.map((w: any, i: number) => (
          <div key={i} className="fc-h-fc" style={{ display: "grid", gridTemplateColumns: DWG_COLS, minWidth: 900, borderBottom: "1px solid #F2F2F4", fontSize: 11, alignItems: "center" }}>
            <div style={{ padding: "10px 12px", fontFamily: MONO, fontWeight: 700 }}>{w.no}</div>
            <div style={{ padding: "10px 12px", fontFamily: MONO }}>{w.rev}</div>
            <div style={{ padding: "8px 12px" }}><span style={sx(CLS[w.cls].chip)}>{CLS[w.cls].label}</span></div>
            <div style={{ padding: "10px 12px", color: "#4A4A52" }}>{w.title}</div>
            <div style={sx(`padding:10px 12px; font-family:${MONO}; text-align:right; font-size:${w.area ? "11.5px" : "10px"}; font-weight:${w.area ? 700 : 400}; color:${w.area ? GREEN : "#9A9AA2"}`)}>{w.area || "estimate required"}</div>
            <div style={{ padding: "10px 12px", color: "#6B6B72", lineHeight: 1.5 }}>
              {w.notes}
              <span style={{ display: "block", fontFamily: MONO, fontSize: 9.5, color: "#9A9AA2", marginTop: 3 }}>{w.clsNote}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FinishingControl;
