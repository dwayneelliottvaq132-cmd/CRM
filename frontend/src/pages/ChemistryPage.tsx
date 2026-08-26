import { useState } from "react";
import { colors, fontMono } from "../lib/theme";
import { fmtDate, fmtDateTime } from "../lib/format";
import { useLogAnalysis, useRecordAddition, useTanks } from "../lib/queries";
import { Card, Table, type Column } from "../components/Table";
import { Chip } from "../components/Chip";
import { Modal, formInput, formLabel } from "../components/Modal";
import type { Tank } from "../lib/types";

export function ChemistryPage() {
  const { data: tanks, isLoading } = useTanks();
  const [logOpen, setLogOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const columns: Column<Tank>[] = [
    { header: "Tank", first: true, render: (t) => <span style={{ fontFamily: fontMono, fontWeight: 600 }}>{t.id}</span> },
    { header: "Solution", render: (t) => <span style={{ fontWeight: 600 }}>{t.solution}</span> },
    { header: "Parameter", render: (t) => <span style={{ color: colors.textMuted }}>{t.parameter}</span> },
    {
      header: "Last Result",
      align: "right",
      render: (t) => (
        <span style={{ fontFamily: fontMono, fontWeight: 600, color: t.held ? colors.red : colors.text }}>{t.last_result ?? "—"}</span>
      ),
    },
    { header: "Control Limits", render: (t) => <span style={{ fontFamily: fontMono, fontSize: 11, color: colors.textFaint }}>{t.limits_text}</span> },
    { header: "Analyzed", render: (t) => <span style={{ fontFamily: fontMono, fontSize: 11 }}>{fmtDate(t.last_analyzed_at)}</span> },
    {
      header: "Next Due",
      render: (t) => (
        <span style={{ fontFamily: fontMono, fontSize: 11, color: t.held ? colors.text : colors.amber }}>
          {t.held ? "—" : fmtDateTime(t.next_due_at)}
        </span>
      ),
    },
    {
      header: "Status",
      last: true,
      render: (t) => <Chip kind={t.held ? "bad" : "good"} text={t.held ? "HELD — OOC" : "In Control"} />,
    },
  ];

  return (
    <section>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <button onClick={() => setLogOpen(true)} style={{ background: colors.accentDefault, color: "#FFFFFF", border: "none", borderRadius: 5, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          + Log Analysis
        </button>
        <button onClick={() => setAddOpen(true)} style={{ background: "#FFFFFF", color: colors.text, border: `1px solid ${colors.cardBorder}`, borderRadius: 5, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          + Record Addition
        </button>
        <div style={{ marginLeft: "auto", fontSize: 12, color: colors.textMuted }}>Out-of-limit results auto-hold affected tanks and block traveler sign-offs on them.</div>
      </div>
      <Card>{isLoading || !tanks ? <div style={{ padding: 20, fontSize: 12 }}>Loading…</div> : <Table columns={columns} rows={tanks} keyFn={(t) => t.id} rowBg={(t) => (t.held ? "#FBF3F1" : undefined)} />}</Card>

      {logOpen && tanks ? <LogAnalysisModal tanks={tanks} onClose={() => setLogOpen(false)} /> : null}
      {addOpen && tanks ? <RecordAdditionModal tanks={tanks} onClose={() => setAddOpen(false)} /> : null}
    </section>
  );
}

function LogAnalysisModal({ tanks, onClose }: { tanks: Tank[]; onClose: () => void }) {
  const [tankId, setTankId] = useState(tanks[0]?.id ?? "");
  const [result, setResult] = useState("");
  const [notes, setNotes] = useState("");
  const mutation = useLogAnalysis();

  return (
    <Modal title="Log Bath Analysis" onClose={onClose}>
      <label style={formLabel}>Tank</label>
      <select value={tankId} onChange={(e) => setTankId(e.target.value)} style={formInput}>
        {tanks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.id} — {t.solution} ({t.parameter})
          </option>
        ))}
      </select>
      <label style={formLabel}>Result</label>
      <input value={result} onChange={(e) => setResult(e.target.value)} type="number" step="any" style={formInput} placeholder={tanks.find((t) => t.id === tankId)?.limits_text} />
      <label style={formLabel}>Notes</label>
      <input value={notes} onChange={(e) => setNotes(e.target.value)} style={formInput} />
      <button
        disabled={!result || mutation.isPending}
        onClick={() => mutation.mutate({ tankId, result: parseFloat(result), notes }, { onSuccess: onClose })}
        style={{ marginTop: 18, width: "100%", background: colors.accentDefault, color: "#FFFFFF", border: "none", borderRadius: 5, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
      >
        {mutation.isPending ? "Logging…" : "Log Result"}
      </button>
    </Modal>
  );
}

function RecordAdditionModal({ tanks, onClose }: { tanks: Tank[]; onClose: () => void }) {
  const [tankId, setTankId] = useState(tanks[0]?.id ?? "");
  const [chemical, setChemical] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const mutation = useRecordAddition();

  return (
    <Modal title="Record Chemical Addition" onClose={onClose}>
      <label style={formLabel}>Tank</label>
      <select value={tankId} onChange={(e) => setTankId(e.target.value)} style={formInput}>
        {tanks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.id} — {t.solution}
          </option>
        ))}
      </select>
      <label style={formLabel}>Chemical</label>
      <input value={chemical} onChange={(e) => setChemical(e.target.value)} style={formInput} />
      <label style={formLabel}>Amount</label>
      <input value={amount} onChange={(e) => setAmount(e.target.value)} style={formInput} placeholder="e.g. 10 lb" />
      <label style={formLabel}>Notes</label>
      <input value={notes} onChange={(e) => setNotes(e.target.value)} style={formInput} />
      <button
        disabled={!chemical || !amount || mutation.isPending}
        onClick={() => mutation.mutate({ tankId, chemical, amount, notes }, { onSuccess: onClose })}
        style={{ marginTop: 18, width: "100%", background: colors.accentDefault, color: "#FFFFFF", border: "none", borderRadius: 5, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
      >
        {mutation.isPending ? "Recording…" : "Record Addition"}
      </button>
    </Modal>
  );
}
