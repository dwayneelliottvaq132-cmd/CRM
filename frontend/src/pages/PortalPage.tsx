import { useEffect, useState } from "react";
import { certPdfUrl } from "../api/endpoints";
import { colors, fontMono } from "../lib/theme";
import { useCustomers, usePortalPreview } from "../lib/queries";

export function PortalPage() {
  const { data: customers } = useCustomers();
  const [customerId, setCustomerId] = useState<number | undefined>();

  useEffect(() => {
    if (!customerId && customers && customers.length) {
      const meridian = customers.find((c) => c.name.includes("Meridian"));
      setCustomerId((meridian ?? customers[0]).id);
    }
  }, [customers, customerId]);

  const { data: jobs } = usePortalPreview(customerId);
  const customer = customers?.find((c) => c.id === customerId);

  return (
    <section style={{ maxWidth: 780, margin: "0 auto" }}>
      <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        Preview of what
        <select
          value={customerId ?? ""}
          onChange={(e) => setCustomerId(Number(e.target.value))}
          style={{ border: `1px solid ${colors.cardBorder}`, borderRadius: 4, padding: "2px 6px", fontSize: 12 }}
        >
          {(customers ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        sees when they log in. Customers see only their own jobs; no ITAR technical data is exposed.
      </div>
      <div style={{ background: "#FFFFFF", border: `1px solid ${colors.cardBorder}`, borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 10px rgba(20,30,35,0.07)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", background: "#24313B" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF" }}>Texas Precision Plating — Customer Portal</div>
          <div style={{ marginLeft: "auto", fontSize: 11, color: "#9BA6AD" }}>
            {customer?.name.toLowerCase().replace(/\s+/g, "-")} · portal user
          </div>
        </div>
        {(jobs ?? []).length === 0 ? (
          <div style={{ padding: 20, fontSize: 12, color: colors.textFaint }}>No jobs on file for this customer yet.</div>
        ) : null}
        {(jobs ?? []).map((pj) => {
          const barColor = pj.pct >= 100 ? colors.green : colors.accentDefault;
          return (
            <div key={pj.po} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderTop: `1px solid ${colors.rowBorder}` }}>
              <div style={{ width: 130 }}>
                <div style={{ fontFamily: fontMono, fontSize: 12, fontWeight: 600 }}>{pj.po}</div>
                <div style={{ fontSize: 11, color: colors.textFaint }}>{pj.part_number}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: colors.textMuted, marginBottom: 5 }}>
                  <span>{pj.stage}</span>
                  <span style={{ fontFamily: fontMono }}>{pj.eta}</span>
                </div>
                <div style={{ height: 7, background: colors.rowBorder, borderRadius: 4 }}>
                  <div style={{ height: 7, borderRadius: 4, background: barColor, width: `${pj.pct}%` }} />
                </div>
              </div>
              {pj.has_cert && pj.cert_id ? (
                <a href={certPdfUrl(pj.cert_id)} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 600 }}>
                  ⬇ C of C
                </a>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
