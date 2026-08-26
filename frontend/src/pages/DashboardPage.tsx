import { useNavigate } from "react-router-dom";
import { colors, fontMono } from "../lib/theme";
import { useDashboard } from "../lib/queries";
import { Card, CardHeader } from "../components/Table";

const KPI_ROUTE: Record<string, string> = {
  wip: "/travelers",
  due48: "/travelers",
  ncrs: "/compliance",
  tanks_ooc: "/chemistry",
  cal_overdue: "/calibration",
  unsynced: "/invoicing",
};

const KIND_COLOR: Record<string, string> = {
  good: colors.text,
  warn: colors.amber,
  bad: colors.red,
  info: colors.text,
  neutral: colors.text,
};
const KIND_EDGE: Record<string, string> = {
  good: colors.accentDefault,
  warn: colors.amber,
  bad: colors.red,
  info: colors.accentDefault,
  neutral: colors.gray,
};

export function DashboardPage() {
  const { data, isLoading } = useDashboard();
  const navigate = useNavigate();

  if (isLoading || !data) return <div style={{ fontSize: 13, color: colors.textFaint }}>Loading dashboard…</div>;

  return (
    <section>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
        {data.kpis.map((k) => (
          <div
            key={k.key}
            className="card-hover"
            onClick={() => navigate(KPI_ROUTE[k.key] ?? "/dashboard")}
            style={{
              background: "#FFFFFF",
              border: `1px solid ${colors.cardBorder}`,
              borderTop: `3px solid ${KIND_EDGE[k.kind] ?? colors.gray}`,
              borderRadius: 6,
              padding: "12px 14px",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 700, fontFamily: fontMono, color: KIND_COLOR[k.kind] ?? colors.text }}>{k.value}</div>
            <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, marginTop: 16 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${colors.rowBorder}` }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Hot Jobs — Due ≤ 48 hrs</div>
            <a href="#" onClick={(e) => { e.preventDefault(); navigate("/travelers"); }} style={{ marginLeft: "auto", fontSize: 12 }}>
              All travelers →
            </a>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {["Job", "Customer", "Process", "Current Op", "Due"].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: i === 0 ? "8px 16px" : i === 4 ? "8px 16px" : "8px 8px",
                      fontSize: 10,
                      letterSpacing: "0.07em",
                      textTransform: "uppercase",
                      color: colors.textFaint,
                      fontWeight: 600,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.hot_jobs.map((j) => (
                <tr
                  key={j.id}
                  className="row-hover"
                  onClick={() => navigate(`/travelers/${j.id}`)}
                  style={{ borderTop: `1px solid ${colors.rowBorder}`, cursor: "pointer" }}
                >
                  <td style={{ padding: "9px 16px", fontFamily: fontMono, fontWeight: 600, color: colors.accentDefault }}>{j.id}</td>
                  <td style={{ padding: "9px 8px" }}>{j.customer}</td>
                  <td style={{ padding: "9px 8px" }}>{j.process}</td>
                  <td style={{ padding: "9px 8px", color: colors.textMuted }}>{j.current_op}</td>
                  <td style={{ padding: "9px 16px" }}>
                    <span style={{ fontFamily: fontMono, fontSize: 11, fontWeight: 600, color: j.due_urgent ? colors.red : colors.textMuted }}>{j.due}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${colors.rowBorder}` }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Tank Alerts</div>
              <a href="#" onClick={(e) => { e.preventDefault(); navigate("/chemistry"); }} style={{ marginLeft: "auto", fontSize: 12 }}>
                Chemistry →
              </a>
            </div>
            {data.tank_alerts.map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 16px", borderTop: `1px solid ${colors.rowBorder}` }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: t.kind === "bad" ? colors.red : colors.amber, marginTop: 5, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>{t.detail}</div>
                </div>
              </div>
            ))}
            {data.tank_alerts.length === 0 ? <div style={{ padding: "10px 16px", fontSize: 12, color: colors.textFaint }}>No active alerts.</div> : null}
          </Card>
          <Card>
            <CardHeader>Compliance Pulse</CardHeader>
            {data.pulse.map((p) => (
              <div key={p.label} style={{ display: "flex", alignItems: "center", padding: "9px 16px", borderTop: `1px solid ${colors.rowBorder}`, fontSize: 12 }}>
                <span>{p.label}</span>
                <span style={{ marginLeft: "auto", fontFamily: fontMono, fontWeight: 600, color: p.kind === "good" ? colors.green : colors.text }}>{p.value}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </section>
  );
}
