import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useDeleteRate, useRates, useSaveRate } from "../../lib/queries";
import type { FinishRate } from "../../lib/types";

/** The rate card, editable in place. Admin-only to change; everyone can read,
 *  because quoting needs the numbers. Rows are edited inline and saved per row
 *  rather than through a modal — this is a table you keep open while quoting,
 *  not a form you visit. The backend is the authority: it rejects a duplicate
 *  process+spec with 409 and a non-Admin write with 403. */

const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const SANS = "'IBM Plex Sans',system-ui,sans-serif";
const INK = "#16161A";
const BODY = "#4A4A52";
const MUTED = "#6B6B72";
const FAINT = "#9A9AA2";
const LINE = "#E1E1E4";
const RED = "#B3261E";

type Draft = Pick<FinishRate, "process" | "spec" | "rate_per_sq_in" | "lot_minimum" | "notes">;

const BLANK: Draft = { process: "", spec: "", rate_per_sq_in: "", lot_minimum: "", notes: "" };

const TH: React.CSSProperties = {
  fontFamily: MONO, fontSize: 9, letterSpacing: "0.1em", color: FAINT, textAlign: "left",
  padding: "8px 12px", borderBottom: `1px solid ${LINE}`, whiteSpace: "nowrap",
};
const TD: React.CSSProperties = { padding: "6px 12px", borderBottom: "1px solid #F0F0F2", verticalAlign: "middle" };

function cell(width?: number, align: "left" | "right" = "left"): React.CSSProperties {
  return {
    width, fontFamily: MONO, fontSize: 11, color: INK, textAlign: align,
    border: `1px solid ${LINE}`, borderRadius: 3, padding: "5px 7px", outline: "none",
    background: "#FFFFFF", boxSizing: "border-box",
  };
}

function Btn({ children, onClick, disabled, tone = "outline" }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; tone?: "primary" | "outline" | "danger";
}) {
  const tones = {
    primary: { background: INK, color: "#FFFFFF", border: `1px solid ${INK}` },
    outline: { background: "#FFFFFF", color: BODY, border: `1px solid ${LINE}` },
    danger: { background: "#FFFFFF", color: RED, border: "1px solid #F0CFCB" },
  }[tone];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: MONO, fontSize: 10, letterSpacing: "0.04em", padding: "4px 9px", borderRadius: 3,
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1, ...tones,
      }}
    >
      {children}
    </button>
  );
}

function num(v: string): string {
  return v.replace(/[^0-9.]/g, "");
}

/** Declared at module scope on purpose: nesting this inside RatesTable made React
 *  treat it as a new component type on every render, remounting the inputs and
 *  discarding whatever had been typed. */
function DraftRow({ value, onChange, onSave, onCancel, saving }: {
  value: Draft; onChange: (d: Draft) => void; onSave: () => void; onCancel: () => void; saving: boolean;
}) {
  return (
    <tr>
      <td style={TD}>
        <input autoFocus value={value.process} onChange={(e) => onChange({ ...value, process: e.target.value })} placeholder="Type II Anodize" style={cell(undefined)} />
      </td>
      <td style={TD}>
        <input value={value.spec} onChange={(e) => onChange({ ...value, spec: e.target.value })} placeholder="MIL-A-8625 Ty II Cl 2" style={cell(undefined)} />
      </td>
      <td style={TD}>
        <input value={value.rate_per_sq_in} onChange={(e) => onChange({ ...value, rate_per_sq_in: num(e.target.value) })} placeholder="0.0000" style={cell(84, "right")} />
      </td>
      <td style={TD}>
        <input value={value.lot_minimum} onChange={(e) => onChange({ ...value, lot_minimum: num(e.target.value) })} placeholder="0.00" style={cell(78, "right")} />
      </td>
      <td style={TD}>
        <input value={value.notes} onChange={(e) => onChange({ ...value, notes: e.target.value })} placeholder="—" style={cell(undefined)} />
      </td>
      <td style={{ ...TD, textAlign: "right", whiteSpace: "nowrap" }}>
        <span style={{ display: "inline-flex", gap: 6 }}>
          <Btn onClick={onCancel}>CANCEL</Btn>
          <Btn tone="primary" onClick={onSave} disabled={saving}>{saving ? "SAVING…" : "SAVE"}</Btn>
        </span>
      </td>
    </tr>
  );
}

export function RatesTable() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";
  const { data: rates, isLoading } = useRates();
  const save = useSaveRate();
  const del = useDeleteRate();

  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState<Draft>(BLANK);
  const [err, setErr] = useState<string | null>(null);

  function detail(e: unknown): string {
    return (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Save failed.";
  }

  async function commit(id: number | undefined, body: Draft) {
    setErr(null);
    if (!body.process.trim()) {
      setErr("Process is required.");
      return;
    }
    try {
      await save.mutateAsync({
        id,
        body: {
          process: body.process.trim(),
          spec: body.spec.trim(),
          rate_per_sq_in: body.rate_per_sq_in || "0",
          lot_minimum: body.lot_minimum || "0",
          notes: body.notes.trim(),
        },
      });
      setEditing(null);
      setAdding(false);
      setNewRow(BLANK);
    } catch (e: unknown) {
      setErr(detail(e));
    }
  }

  function beginEdit(r: FinishRate) {
    setErr(null);
    setEditing(r.id);
    setDraft({ process: r.process, spec: r.spec, rate_per_sq_in: r.rate_per_sq_in, lot_minimum: r.lot_minimum, notes: r.notes });
  }

  return (
    <section style={{ background: "#FFFFFF", border: `1px solid ${LINE}`, borderRadius: 5, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: `1px solid ${LINE}` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: INK }}>Rate card</div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, marginTop: 2 }}>
            {isAdmin ? "$/in² by process · lot minimum is a floor on the line" : "read-only — Admin role required to edit"}
          </div>
        </div>
        {isAdmin ? (
          <Btn tone="primary" onClick={() => { setErr(null); setAdding(true); setNewRow(BLANK); }} disabled={adding}>+ ADD RATE</Btn>
        ) : null}
      </header>

      {err ? (
        <div style={{ margin: "10px 14px", padding: "8px 11px", borderRadius: 4, background: "#FFF8F7", border: "1px solid #F5DEDB", fontFamily: MONO, fontSize: 10, color: RED }}>{err}</div>
      ) : null}

      <div style={{ overflow: "auto", flex: 1, minHeight: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={TH}>PROCESS</th>
              <th style={TH}>SPEC</th>
              <th style={{ ...TH, textAlign: "right" }}>$/IN²</th>
              <th style={{ ...TH, textAlign: "right" }}>LOT MIN</th>
              <th style={TH}>NOTES</th>
              <th style={{ ...TH, textAlign: "right" }} />
            </tr>
          </thead>
          <tbody>
            {adding ? (
              <DraftRow value={newRow} onChange={setNewRow} onSave={() => void commit(undefined, newRow)} onCancel={() => { setAdding(false); setErr(null); }} saving={save.isPending} />
            ) : null}

            {isLoading ? (
              <tr><td colSpan={6} style={{ ...TD, fontFamily: MONO, fontSize: 10.5, color: FAINT, padding: "16px 12px" }}>Loading…</td></tr>
            ) : !rates?.length && !adding ? (
              <tr>
                <td colSpan={6} style={{ ...TD, fontFamily: MONO, fontSize: 10.5, color: FAINT, padding: "16px 12px", lineHeight: 1.6 }}>
                  No rates yet. {isAdmin ? "Add one — these are the numbers the surface-area price uses." : "An Admin needs to add them."}
                </td>
              </tr>
            ) : (
              rates?.map((r) =>
                editing === r.id ? (
                  <DraftRow key={r.id} value={draft} onChange={setDraft} onSave={() => void commit(r.id, draft)} onCancel={() => { setEditing(null); setErr(null); }} saving={save.isPending} />
                ) : (
                  <tr key={r.id}>
                    <td style={{ ...TD, fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: INK }}>{r.process}</td>
                    <td style={{ ...TD, fontFamily: MONO, fontSize: 10.5, color: BODY }}>{r.spec || "—"}</td>
                    <td style={{ ...TD, fontFamily: MONO, fontSize: 12, fontWeight: 700, color: INK, textAlign: "right" }}>{r.rate_per_sq_in}</td>
                    <td style={{ ...TD, fontFamily: MONO, fontSize: 11, color: BODY, textAlign: "right" }}>${r.lot_minimum}</td>
                    <td style={{ ...TD, fontFamily: MONO, fontSize: 10, color: MUTED }}>{r.notes || "—"}</td>
                    <td style={{ ...TD, textAlign: "right", whiteSpace: "nowrap" }}>
                      {isAdmin ? (
                        <span style={{ display: "inline-flex", gap: 6 }}>
                          <Btn onClick={() => beginEdit(r)}>EDIT</Btn>
                          <Btn tone="danger" onClick={() => void del.mutateAsync(r.id)} disabled={del.isPending}>DELETE</Btn>
                        </span>
                      ) : (
                        <span style={{ fontFamily: MONO, fontSize: 9.5, color: FAINT }}>{r.updated_by ? `by ${r.updated_by}` : ""}</span>
                      )}
                    </td>
                  </tr>
                ),
              )
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
