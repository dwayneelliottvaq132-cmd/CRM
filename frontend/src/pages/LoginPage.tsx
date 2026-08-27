import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { colors, fontMono } from "../lib/theme";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // RFQ Intake is the app's home; Finishing Control and the ERP live on at
  // their own routes. A deep link the user was bounced off still wins.
  if (user) return <Navigate to={(location.state as { from?: string })?.from ?? "/rfq"} replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      navigate("/rfq", { replace: true });
    } catch {
      setError("Incorrect email or password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: colors.sidebarBg }}>
      <form
        onSubmit={handleSubmit}
        style={{ background: "#FFFFFF", borderRadius: 8, padding: "32px 36px", width: 360, boxShadow: "0 8px 30px rgba(0,0,0,0.3)" }}
      >
        <div style={{ fontSize: 17, fontWeight: 700, color: colors.text }}>TPP ERP</div>
        <div style={{ fontFamily: fontMono, fontSize: 10, color: colors.textFaint, marginTop: 3, marginBottom: 24 }}>
          NADCAP · AS9100D · ITAR
        </div>

        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: colors.textFaint, marginBottom: 4 }}>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
          style={{ width: "100%", border: `1px solid ${colors.cardBorder}`, borderRadius: 5, padding: "9px 12px", fontSize: 13, marginBottom: 14 }}
        />

        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: colors.textFaint, marginBottom: 4 }}>Password</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
          style={{ width: "100%", border: `1px solid ${colors.cardBorder}`, borderRadius: 5, padding: "9px 12px", fontSize: 13, marginBottom: 18 }}
        />

        {error ? <div style={{ fontSize: 12, color: colors.red, marginBottom: 12 }}>{error}</div> : null}

        <button
          type="submit"
          disabled={busy}
          style={{ width: "100%", background: colors.accentDefault, color: "#FFFFFF", border: "none", borderRadius: 5, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <div style={{ fontSize: 11, color: colors.textFaint, marginTop: 16, lineHeight: 1.5 }}>
          See RUNNING.md for demo login credentials.
        </div>
      </form>
    </div>
  );
}
