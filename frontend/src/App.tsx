import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import { KioskShell } from "./components/KioskShell";
import { LoginPage } from "./pages/LoginPage";
import { KioskScanPage } from "./pages/KioskScanPage";
import { DashboardPage } from "./pages/DashboardPage";
import { QuotingPage } from "./pages/QuotingPage";
import { SalesOrdersPage } from "./pages/SalesOrdersPage";
import { CustomersPage } from "./pages/CustomersPage";
import { PlanningPage } from "./pages/PlanningPage";
import { TravelersPage } from "./pages/TravelersPage";
import { ShopFloorPage } from "./pages/ShopFloorPage";
import { ChemistryPage } from "./pages/ChemistryPage";
import { CompliancePage } from "./pages/CompliancePage";
import { CertsPage } from "./pages/CertsPage";
import { InvoicingPage } from "./pages/InvoicingPage";
import { CalibrationPage } from "./pages/CalibrationPage";
import { InventoryPage } from "./pages/InventoryPage";
import { VendorsPage } from "./pages/VendorsPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { PortalPage } from "./pages/PortalPage";
import { ApiPage } from "./pages/ApiPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { FinishingControl } from "./pages/finishing/FinishingControl";
import { RequireAuth } from "./pages/finishing/RequireAuth";
import { RfqApp } from "./pages/rfq/RfqApp";

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40, fontFamily: "'IBM Plex Sans', sans-serif" }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

// Nav already hides the "Users & Admin" link for non-admins (Layout.tsx); this catches
// direct navigation to the URL. The backend is the real gate — every /users admin
// endpoint carries require_role("Admin") independently of this check.
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "Admin") {
    return (
      <div style={{ padding: 40, fontSize: 13, color: "#5E686E" }}>
        You don't have access to this page. Admin role required.
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/rfq" replace />} />
      <Route path="/dashboard" element={<ProtectedShell><DashboardPage /></ProtectedShell>} />
      <Route path="/quoting" element={<ProtectedShell><QuotingPage /></ProtectedShell>} />
      <Route path="/sales-orders" element={<ProtectedShell><SalesOrdersPage /></ProtectedShell>} />
      <Route path="/orders" element={<Navigate to="/sales-orders" replace />} />
      <Route path="/planning" element={<ProtectedShell><PlanningPage /></ProtectedShell>} />
      <Route path="/process-planning" element={<Navigate to="/planning" replace />} />
      <Route path="/travelers" element={<ProtectedShell><TravelersPage /></ProtectedShell>} />
      <Route path="/travelers/:jobId" element={<ProtectedShell><TravelersPage /></ProtectedShell>} />
      <Route path="/shopfloor" element={<ProtectedShell><ShopFloorPage /></ProtectedShell>} />
      <Route path="/shopfloor/:jobId" element={<ProtectedShell><ShopFloorPage /></ProtectedShell>} />
      <Route path="/kiosk" element={<KioskShell><KioskScanPage /></KioskShell>} />
      <Route path="/chemistry" element={<ProtectedShell><ChemistryPage /></ProtectedShell>} />
      <Route path="/compliance" element={<ProtectedShell><CompliancePage /></ProtectedShell>} />
      <Route path="/certs" element={<ProtectedShell><CertsPage /></ProtectedShell>} />
      <Route path="/invoicing" element={<ProtectedShell><InvoicingPage /></ProtectedShell>} />
      <Route path="/calibration" element={<ProtectedShell><CalibrationPage /></ProtectedShell>} />
      <Route path="/inventory" element={<ProtectedShell><InventoryPage /></ProtectedShell>} />
      <Route path="/vendors" element={<ProtectedShell><VendorsPage /></ProtectedShell>} />
      <Route path="/customers" element={<ProtectedShell><CustomersPage /></ProtectedShell>} />
      <Route path="/documents" element={<ProtectedShell><DocumentsPage /></ProtectedShell>} />
      <Route path="/portal" element={<ProtectedShell><PortalPage /></ProtectedShell>} />
      <Route path="/api" element={<ProtectedShell><ApiPage /></ProtectedShell>} />
      <Route path="/rfq" element={<RequireAuth><RfqApp /></RequireAuth>} />
      <Route path="/profile" element={<ProtectedShell><ProfilePage /></ProtectedShell>} />
      <Route path="/admin/users" element={<ProtectedShell><RequireAdmin><AdminUsersPage /></RequireAdmin></ProtectedShell>} />
      <Route path="/finishing" element={<RequireAuth><FinishingControl /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
