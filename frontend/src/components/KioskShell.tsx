import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/** Minimal shell for a shared shop-floor kiosk terminal — same auth gate as the normal
 * app shell, but deliberately no sidebar/nav: a walk-up tank-side scanner shouldn't put
 * Invoicing/Customers/etc. one tap away from an operator mid-process. */
export function KioskShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40, fontFamily: "'IBM Plex Sans', sans-serif" }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <div style={{ minHeight: "100vh", background: "#12181B" }}>{children}</div>;
}
