import { useState } from "react";
import { capaPhaseKind, colors, fontMono, ncrDispositionKind } from "../lib/theme";
import { fmtDate } from "../lib/format";
import { useAuditPrograms, useCapas, useCreateNcr, useJobs, useNcrs, useTanks } from "../lib/queries";
import { Card } from "../components/Table";
import { Chip } from "../components/Chip";
import { Modal, formInput, formLabel } from "../components/Modal";

export function CompliancePage() {
  const { data: ncrs, isLoading: ncrsLoading } = useNcrs();
  const { data: capas } = useCapas();
  const { data: audits } = useAuditPrograms();
  const [newNcrOpen, setNewNcrOpen] = useState(false);

  return (
    <section style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${colors.rowBorder}` }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Nonconformance Reports</div>
            <button
              onClick={() => setNewNcrOpen(true)}
              style={{ marginLeft: "auto", background: colors.accentDefault, color: "#FFFFFF", border: "none", borderRadius: 5, padding: "6px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
            >
              + New NCR
            </button>
          </div>
          {ncrsLoading || !ncrs ? (
            <div style={{ padding: 16, fontSize: 12 }}>Loading…</div>
          ) : (
            ncrs.map((n) => (
              <div key={n.id} style={{ padding: "11px 16px", borderTop: `1px solid ${colors.rowBorder}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: fontMono, fontSize: 12, fontWeight: 600, color: colors.accentDefault }}>{n.id}</span>
                  <Chip kind={ncrDispositionKind(n.disposition)} text={n.disposition} />
                  <span style={{ marginLeft: "auto", fontFamily: fontMono, fontSize: 10, color: colors.textFaint }}>
                    {n.reference_label} · {fmtDate(n.opened_at)}
                  </span>
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>{n.description}</div>
              </div>
            ))
          )}
        </Card>

        <Card>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.rowBorder}`, fontSize: 13, fontWeight: 700 }}>Corrective Actions (CAPA)</div>
          {(capas ?? []).map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderTop: `1px solid ${colors.rowBorder}`, fontSize: 12 }}>
              <span style={{ fontFamily: fontMono, fontWeight: 600, color: colors.accentDefault }}>{c.id}</span>
              <span style={{ flex: 1 }}>{c.description}</span>
              <span style={{ fontFamily: fontMono, fontSize: 11, color: c.phase === "Implement" ? colors.amber : colors.textMuted }}>
                {c.closed_date ? `Closed ${fmtDate(c.closed_date)}` : fmtDate(c.due_date)}
              </span>
              <Chip kind={capaPhaseKind(c.phase)} text={c.phase} />
            </div>
          ))}
        </Card>
      </div>

      <Card>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.rowBorder}`, fontSize: 13, fontWeight: 700 }}>Audit Readiness</div>
        {(audits ?? []).map((a) => {
          const color = a.pct_complete >= 85 ? colors.green : colors.amber;
          return (
            <div key={a.id} style={{ padding: "12px 16px", borderTop: `1px solid ${colors.rowBorder}` }}>
              <div style={{ display: "flex", alignItems: "center", fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}>{a.name}</span>
                <span style={{ marginLeft: "auto", fontFamily: fontMono, fontWeight: 600, color }}>{a.pct_complete}%</span>
              </div>
              <div style={{ height: 6, background: colors.rowBorder, borderRadius: 3, marginTop: 7 }}>
                <div style={{ height: 6, borderRadius: 3, background: color, width: `${a.pct_complete}%` }} />
              </div>
              <div style={{ fontSize: 11, color: colors.textFaint, marginTop: 5 }}>{a.note}</div>
            </div>
          );
        })}
      </Card>

      {newNcrOpen ? <NewNcrModal onClose={() => setNewNcrOpen(false)} /> : null}
    </section>
  );
}

function NewNcrModal({ onClose }: { onClose: () => void }) {
  const { data: jobs } = useJobs();
  const { data: tanks } = useTanks();
  const mutation = useCreateNcr();
  const [refType, setRefType] = useState<"job" | "tank">("job");
  const [refId, setRefId] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  function nextId() {
    const year = new Date().getFullYear().toString().slice(2);
    return `NCR-${year}-${Math.floor(100 + Math.random() * 900)}`;
  }

  function submit() {
    if (!refId || !description) return;
    const id = nextId();
    mutation.mutate(
      {
        id,
        reference_label: refId,
        disposition: "Open — MRB",
        description,
        job_id: refType === "job" ? refId : null,
        tank_id: refType === "tank" ? refId : null,
      },
      { onSuccess: onClose, onError: () => setError("Could not create NCR — try again.") },
    );
  }

  return (
    <Modal title="New Nonconformance Report" onClose={onClose}>
      <label style={formLabel}>Reference type</label>
      <select value={refType} onChange={(e) => { setRefType(e.target.value as "job" | "tank"); setRefId(""); }} style={formInput}>
        <option value="job">Job</option>
        <option value="tank">Tank</option>
      </select>
      <label style={formLabel}>Reference</label>
      <select value={refId} onChange={(e) => setRefId(e.target.value)} style={formInput}>
        <option value="">Select…</option>
        {(refType === "job" ? jobs ?? [] : tanks ?? []).map((r) => (
          <option key={r.id} value={r.id}>
            {r.id}
          </option>
        ))}
      </select>
      <label style={formLabel}>Description</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...formInput, minHeight: 70, fontFamily: "inherit" }} />
      {error ? <div style={{ color: colors.red, fontSize: 12, marginTop: 8 }}>{error}</div> : null}
      <button
        disabled={!refId || !description || mutation.isPending}
        onClick={submit}
        style={{ marginTop: 18, width: "100%", background: colors.accentDefault, color: "#FFFFFF", border: "none", borderRadius: 5, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
      >
        {mutation.isPending ? "Opening…" : "Open NCR"}
      </button>
    </Modal>
  );
}
