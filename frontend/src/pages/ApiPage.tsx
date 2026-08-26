import { colors, fontMono, type ChipKind } from "../lib/theme";
import { fmtDateTime } from "../lib/format";
import {
  useApiEndpoints,
  useEmailIntakeLog,
  useEmailIntakeStatus,
  useIntegrationInfo,
  usePollEmailIntakeNow,
  useQbStatusQuery,
} from "../lib/queries";
import { Chip } from "../components/Chip";
import { Card } from "../components/Table";

const METHOD_COLOR: Record<string, string> = { GET: "#2F6B4F", POST: "#34698C", PATCH: "#7A5A1E" };

const LOG_STATUS_KIND: Record<string, ChipKind> = {
  Scanned: "good",
  "Skipped-Sender": "neutral",
  "Skipped-NoPdf": "neutral",
  Error: "bad",
};

export function ApiPage() {
  const { data: endpoints } = useApiEndpoints();
  const { data: info } = useIntegrationInfo();
  const { data: qb } = useQbStatusQuery();
  const { data: emailIntake } = useEmailIntakeStatus();
  const { data: emailLog } = useEmailIntakeLog();
  const pollNow = usePollEmailIntakeNow();
  const baseUrl = (import.meta.env.VITE_API_BASE_URL as string) ?? "http://localhost:8000/api/v1";

  return (
    <div style={{ display: "grid", gap: 16 }}>
    <section style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, alignItems: "start" }}>
      <div style={{ background: "#FFFFFF", border: `1px solid ${colors.cardBorder}`, borderRadius: 6 }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.rowBorder}`, display: "flex", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>REST API v1</div>
          <span style={{ fontFamily: fontMono, fontSize: 11, color: colors.textFaint }}>FastAPI · OpenAPI 3.1 · OAuth2 client-credentials</span>
        </div>
        {(endpoints ?? []).map((ep) => (
          <div key={ep.path + ep.method} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", borderTop: `1px solid ${colors.rowBorder}` }}>
            <span style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 600, color: "#FFFFFF", background: METHOD_COLOR[ep.method] ?? colors.gray, padding: "2px 7px", borderRadius: 3, width: 42, textAlign: "center" }}>
              {ep.method}
            </span>
            <span style={{ fontFamily: fontMono, fontSize: 12 }}>{ep.path}</span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: colors.textFaint, textAlign: "right" }}>{ep.desc}</span>
          </div>
        ))}
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${colors.rowBorder}`, fontSize: 11, color: colors.textFaint }}>
          Every mutation is written to an immutable audit log (who, what, when, before/after) — required for AS9100 record integrity. Webhooks fire on{" "}
          {(info?.webhooks as string[] | undefined)?.join(", ") ?? "job.status_changed, ncr.opened, invoice.paid"}.{" "}
          <a href={`${baseUrl.replace(/\/api\/v1$/, "")}/docs`} target="_blank" rel="noreferrer">
            Full interactive docs →
          </a>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "#FFFFFF", border: `1px solid ${colors.cardBorder}`, borderRadius: 6, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 6, background: "#2CA01C", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15 }}>
              qb
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>QuickBooks Online</div>
              <div style={{ fontSize: 11, color: qb?.connected ? colors.green : colors.amber, fontWeight: 600 }}>
                {qb?.connected ? "● Connected via OAuth2" : qb?.mode === "simulated" ? "○ Simulated (no live credentials)" : "○ Not connected"}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 10, lineHeight: 1.5 }}>
            Pushes: invoices, payments, credit memos, new customers. Pulls: payment status, chart of accounts. {qb?.detail}
          </div>
        </div>

        <div style={{ background: "#FFFFFF", border: `1px solid ${colors.cardBorder}`, borderRadius: 6, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 6, background: colors.accentDefault, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15 }}>
              ✉
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Email Drawing Intake</div>
              <div style={{ fontSize: 11, color: emailIntake?.configured ? colors.green : colors.amber, fontWeight: 600 }}>
                {emailIntake?.configured ? "● Configured — polling IMAP" : "○ Not configured"}
              </div>
            </div>
            <button
              onClick={() => pollNow.mutate()}
              disabled={!emailIntake?.configured || pollNow.isPending}
              style={{
                marginLeft: "auto", background: emailIntake?.configured ? colors.accentDefault : colors.gray,
                color: "#FFFFFF", border: "none", borderRadius: 5, padding: "5px 10px", fontSize: 11, fontWeight: 600,
                cursor: emailIntake?.configured ? "pointer" : "not-allowed",
              }}
            >
              {pollNow.isPending ? "Polling…" : "Poll Now"}
            </button>
          </div>
          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 10, lineHeight: 1.5 }}>
            Scans PDF attachments from allowlisted senders through the same AI Drawing Scan used for manual uploads.{" "}
            {emailIntake?.detail}
          </div>
          {emailIntake?.configured ? (
            <div style={{ fontSize: 10, color: colors.textFaint, marginTop: 8, fontFamily: fontMono }}>
              {emailIntake.imap_host} · folder: {emailIntake.imap_folder} · every {emailIntake.poll_interval_minutes} min
              <br />
              allowed senders: {emailIntake.allowed_senders.length > 0 ? emailIntake.allowed_senders.join(", ") : "(none configured)"}
              <br />
              last poll: {emailIntake.last_poll_at ? fmtDateTime(emailIntake.last_poll_at) : "never"}
              {emailIntake.last_error ? (
                <>
                  <br />
                  <span style={{ color: colors.red }}>
                    last error ({emailIntake.last_error_at ? fmtDateTime(emailIntake.last_error_at) : "—"}): {emailIntake.last_error}
                  </span>
                </>
              ) : null}
            </div>
          ) : null}
          {pollNow.isError ? (
            <div style={{ fontSize: 11, color: colors.red, marginTop: 8 }}>
              {(pollNow.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Poll failed."}
            </div>
          ) : null}
        </div>

        <div style={{ background: colors.sidebarBg, borderRadius: 6, padding: 16, fontFamily: fontMono, fontSize: 11, color: "#A8C7DC", lineHeight: 1.7, overflowX: "auto" }}>
          <div style={{ color: "#6E7B84" }}># Example: pull open jobs</div>
          <div>curl {baseUrl}/jobs?status=In+Process \</div>
          <div>&nbsp;&nbsp;-H "Authorization: Bearer $TOKEN"</div>
          <div style={{ marginTop: 8, color: "#6E7B84" }}># → 200 OK</div>
          <div>{'{ "id": "J-26187",'}</div>
          <div>&nbsp;&nbsp;"spec": "MIL-A-8625F-T2-C2",</div>
          <div>&nbsp;&nbsp;{'"itar": true, "status": "In Process" }'}</div>
        </div>
      </div>
    </section>

    {(emailLog ?? []).length > 0 ? (
      <Card>
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${colors.rowBorder}`, fontSize: 13, fontWeight: 700 }}>
          Email Intake — Recent Activity
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {["When", "Sender", "Subject", "Attachment", "Status"].map((h, i) => (
                <th key={h} style={{ textAlign: "left", padding: i === 0 ? "7px 20px" : "7px 8px", fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: colors.textFaint, fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(emailLog ?? []).map((row) => (
              <tr key={row.id} style={{ borderTop: `1px solid ${colors.rowBorder}` }}>
                <td style={{ padding: "8px 20px", fontFamily: fontMono, fontSize: 11, color: colors.textMuted }}>{fmtDateTime(row.processed_at)}</td>
                <td style={{ padding: "8px 8px", fontSize: 11 }}>{row.sender}</td>
                <td style={{ padding: "8px 8px", fontSize: 11, color: colors.textMuted }}>{row.subject || "—"}</td>
                <td style={{ padding: "8px 8px", fontFamily: fontMono, fontSize: 11 }}>{row.attachment_filename ?? "—"}</td>
                <td style={{ padding: "8px 20px 8px 8px" }}>
                  <Chip kind={LOG_STATUS_KIND[row.status] ?? "neutral"} text={row.status} />
                  {row.status === "Error" && row.error_detail ? (
                    <div style={{ fontSize: 10, color: colors.red, marginTop: 2 }}>{row.error_detail}</div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    ) : null}
    </div>
  );
}
