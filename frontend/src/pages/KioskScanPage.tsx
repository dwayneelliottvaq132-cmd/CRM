import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import * as api from "../api/endpoints";
import { useOperatorByPin, useStartOp, useSignoffOp, useBatchSignoffOp } from "../lib/queries";
import type { JobDetail, JobOperation } from "../lib/types";

const KIOSK_TANKS_KEY = "kiosk_tanks";

function beep(ok: boolean) {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = ok ? 880 : 220;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.12 : 0.3));
  } catch {
    // best-effort only — a silent kiosk still works, just without the beep
  }
}

function extractError(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return typeof detail === "string" ? detail : "Something went wrong.";
}

function currentOp(job: JobDetail): JobOperation | undefined {
  return job.ops.find((o) => !o.done);
}

function NumKeypad({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit: () => void }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, width: 320 }}>
      {keys.map((k) => (
        <button
          key={k}
          onClick={() => {
            if (k === "⌫") onChange(value.slice(0, -1));
            else if (k === "✓") onSubmit();
            else if (value.length < 6) onChange(value + k);
          }}
          style={{
            padding: "22px 0",
            fontSize: 26,
            fontWeight: 700,
            borderRadius: 10,
            border: "none",
            background: k === "✓" ? "#3E8E5A" : "#2A343A",
            color: "#FFFFFF",
            cursor: "pointer",
          }}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

export function KioskScanPage() {
  const [searchParams] = useSearchParams();
  const [allowedTanks, setAllowedTanks] = useState<string[]>([]);

  const [pinEntry, setPinEntry] = useState("");
  const [sessionPin, setSessionPin] = useState<string | null>(null);
  const [operatorName, setOperatorName] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: "ok" | "error" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingOp, setPendingOp] = useState<{ job: JobDetail; op: JobOperation; values: Record<string, string> } | null>(null);

  const scanRef = useRef<HTMLInputElement>(null);
  const [scanValue, setScanValue] = useState("");

  const operatorByPin = useOperatorByPin();
  const startOp = useStartOp();
  const signoffOp = useSignoffOp();
  const batchSignoffOp = useBatchSignoffOp();

  useEffect(() => {
    const fromUrl = searchParams.get("tanks");
    if (fromUrl) {
      const tanks = fromUrl.split(",").map((t) => t.trim()).filter(Boolean);
      localStorage.setItem(KIOSK_TANKS_KEY, JSON.stringify(tanks));
      setAllowedTanks(tanks);
    } else {
      const stored = localStorage.getItem(KIOSK_TANKS_KEY);
      if (stored) setAllowedTanks(JSON.parse(stored));
    }
  }, [searchParams]);

  useEffect(() => {
    if (sessionPin && !pendingOp) scanRef.current?.focus();
  }, [sessionPin, pendingOp]);

  function showFlash(kind: "ok" | "error" | "warn", text: string) {
    setFlash({ kind, text });
    beep(kind === "ok");
    window.setTimeout(() => setFlash(null), 3500);
  }

  async function handlePinSubmit() {
    if (pinEntry.length < 4) {
      showFlash("error", "PIN must be at least 4 digits");
      return;
    }
    try {
      const operator = await operatorByPin.mutateAsync(pinEntry);
      setSessionPin(pinEntry);
      setOperatorName(operator.name);
      showFlash("ok", `Welcome, ${operator.name}`);
    } catch {
      showFlash("error", "PIN not recognized");
    } finally {
      setPinEntry("");
    }
  }

  function logOut() {
    setSessionPin(null);
    setOperatorName(null);
    setPendingOp(null);
    setScanValue("");
  }

  const handleJobScan = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim();
      if (!code || !sessionPin) return;
      setBusy(true);
      try {
        const job = await api.getJob(code);
        const op = currentOp(job);
        if (!op) {
          showFlash("warn", `${job.id} is already complete.`);
          return;
        }
        if (allowedTanks.length > 0 && op.tank_id && !allowedTanks.includes(op.tank_id)) {
          showFlash("warn", `${job.id} is at Tank ${op.tank_id} — wrong station.`);
          return;
        }

        if (!op.started_at) {
          await startOp.mutateAsync({ jobId: job.id, seq: op.seq, pin: sessionPin });
          showFlash("ok", `Started — ${job.id} ${op.name}`);
          return;
        }

        const manualParams = (op.required_parameters ?? []).filter((p) => p.required && !p.auto_computed);
        if (manualParams.length > 0) {
          setPendingOp({ job, op, values: {} });
          return;
        }

        await signOffJob(job, op, {});
      } catch (err: unknown) {
        showFlash("error", extractError(err));
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionPin, allowedTanks]
  );

  async function signOffJob(job: JobDetail, op: JobOperation, values: Record<string, string>) {
    if (!sessionPin) return;
    const readings = Object.entries(values)
      .filter(([, v]) => v.trim() !== "")
      .map(([key, v]) => {
        const param = (op.required_parameters ?? []).find((p) => p.key === key);
        return { key, value: param?.kind === "text" ? v : Number(v) };
      });
    const candidates = await api.getBatchCandidates(job.id);
    if (candidates.length > 0) {
      const jobIds = [job.id, ...candidates.map((c) => c.id)];
      await batchSignoffOp.mutateAsync({ jobIds, pin: sessionPin, readings });
      showFlash("ok", `Signed off ${jobIds.length} job(s) — ${op.name}`);
    } else {
      await signoffOp.mutateAsync({ jobId: job.id, seq: op.seq, pin: sessionPin, readings });
      showFlash("ok", `Signed off — ${job.id} ${op.name}`);
    }
  }

  async function handlePendingConfirm() {
    if (!pendingOp) return;
    const missing = (pendingOp.op.required_parameters ?? []).filter(
      (p) => p.required && !p.auto_computed && !pendingOp.values[p.key]?.trim()
    );
    if (missing.length > 0) {
      showFlash("error", `Enter a value for: ${missing.map((p) => p.label).join(", ")}`);
      return;
    }
    setBusy(true);
    try {
      await signOffJob(pendingOp.job, pendingOp.op, pendingOp.values);
      setPendingOp(null);
    } catch (err: unknown) {
      showFlash("error", extractError(err));
    } finally {
      setBusy(false);
    }
  }

  const flashColor = flash?.kind === "ok" ? "#2E5E3F" : flash?.kind === "warn" ? "#6B5420" : "#6B2A2A";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'IBM Plex Sans', sans-serif",
        color: "#FFFFFF",
        padding: 24,
        boxSizing: "border-box",
        transition: "background 0.2s",
        background: flash ? flashColor : "#12181B",
      }}
    >
      {!sessionPin ? (
        <>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Enter Your PIN</div>
          <div style={{ fontSize: 32, letterSpacing: "0.4em", fontFamily: "monospace", marginBottom: 24, minHeight: 40 }}>
            {"•".repeat(pinEntry.length)}
          </div>
          <NumKeypad value={pinEntry} onChange={setPinEntry} onSubmit={handlePinSubmit} />
        </>
      ) : pendingOp ? (
        <div style={{ width: 420 }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{pendingOp.job.id} — {pendingOp.op.name}</div>
          <div style={{ fontSize: 13, color: "#9AA5A0", marginBottom: 20 }}>Enter the recorded values to sign off</div>
          {(pendingOp.op.required_parameters ?? [])
            .filter((p) => p.required && !p.auto_computed)
            .map((p) => (
              <div key={p.key} style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
                  {p.label}
                  {p.unit ? ` (${p.unit})` : ""}
                </label>
                <input
                  type={p.kind === "text" ? "text" : "number"}
                  value={pendingOp.values[p.key] ?? ""}
                  onChange={(e) =>
                    setPendingOp((prev) => (prev ? { ...prev, values: { ...prev.values, [p.key]: e.target.value } } : prev))
                  }
                  style={{ width: "100%", boxSizing: "border-box", padding: "16px 14px", fontSize: 22, borderRadius: 8, border: "1px solid #445055", background: "#1C2428", color: "#FFFFFF" }}
                />
                {p.target_min != null || p.target_max != null ? (
                  <div style={{ fontSize: 11, color: "#9AA5A0", marginTop: 4 }}>
                    target: {p.target_min ?? "—"}–{p.target_max ?? "—"}
                  </div>
                ) : null}
              </div>
            ))}
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button
              onClick={() => setPendingOp(null)}
              style={{ flex: 1, padding: "16px 0", fontSize: 15, fontWeight: 600, borderRadius: 8, border: "1px solid #445055", background: "transparent", color: "#FFFFFF", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              onClick={handlePendingConfirm}
              disabled={busy}
              style={{ flex: 2, padding: "16px 0", fontSize: 15, fontWeight: 700, borderRadius: 8, border: "none", background: "#3E8E5A", color: "#FFFFFF", cursor: "pointer" }}
            >
              {busy ? "Signing off…" : "Confirm Sign Off"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 15, color: "#9AA5A0", marginBottom: 6 }}>Ready — {operatorName}</div>
          <div style={{ fontSize: 30, fontWeight: 700, marginBottom: 18 }}>Scan a job</div>
          {flash ? <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 18 }}>{flash.text}</div> : null}
          <input
            ref={scanRef}
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleJobScan(scanValue);
                setScanValue("");
              }
            }}
            onBlur={() => scanRef.current?.focus()}
            autoFocus
            style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
          />
          <button
            onClick={logOut}
            style={{ marginTop: 30, padding: "10px 20px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "1px solid #445055", background: "transparent", color: "#9AA5A0", cursor: "pointer" }}
          >
            Log Out
          </button>
          {allowedTanks.length > 0 ? (
            <div style={{ marginTop: 14, fontSize: 11, color: "#6C7A75" }}>Station scoped to Tank {allowedTanks.join(", ")}</div>
          ) : null}
        </>
      )}
    </div>
  );
}
