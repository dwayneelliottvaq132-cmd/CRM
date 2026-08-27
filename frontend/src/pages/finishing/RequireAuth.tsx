import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/** Auth gate with no chrome of its own.
 *
 * Finishing Control ships its own full-height header and navigation, so it can't go
 * through ProtectedShell (which wraps children in the ERP Layout and would stack two
 * sets of chrome). This is the same gate KioskShell applies — identical loading and
 * redirect behaviour — minus the kiosk's shop-floor background, which would show
 * through if this page ever scrolled past the viewport. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div style={{ padding: 40, fontFamily: "'IBM Plex Sans', sans-serif" }}>Loading…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
