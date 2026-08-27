import { type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { colors, fontMono, fontSans } from "../lib/theme";
import { useAuth } from "../context/AuthContext";
import {
  useCertQueue,
  useDashboard,
  useEquipment,
  useInventory,
  useInvoices,
  useNcrs,
  useOrders,
  usePlanningQueue,
  useTanks,
} from "../lib/queries";

interface NavItem {
  key: string;
  icon: string;
  label: string;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", icon: "◧", label: "Dashboard", path: "/dashboard" },
  { key: "quoting", icon: "✦", label: "Quoting", path: "/quoting" },
  { key: "salesOrders", icon: "⎘", label: "Sales Orders", path: "/sales-orders" },
  { key: "customers", icon: "⊙", label: "Customers", path: "/customers" },
  { key: "planning", icon: "⛓", label: "Planning", path: "/planning" },
  { key: "travelers", icon: "⛁", label: "Travelers", path: "/travelers" },
  { key: "shopfloor", icon: "▶", label: "Shop Floor", path: "/shopfloor" },
  { key: "chemistry", icon: "⚗", label: "Bath Chemistry", path: "/chemistry" },
  { key: "compliance", icon: "✓", label: "Compliance", path: "/compliance" },
  { key: "certs", icon: "§", label: "Certs & C of C", path: "/certs" },
  { key: "invoicing", icon: "$", label: "Invoicing", path: "/invoicing" },
  { key: "calibration", icon: "◷", label: "Calibration", path: "/calibration" },
  { key: "inventory", icon: "▤", label: "Inventory", path: "/inventory" },
  { key: "vendors", icon: "⇄", label: "Vendors", path: "/vendors" },
  { key: "documents", icon: "¶", label: "Doc Control", path: "/documents" },
  { key: "portal", icon: "◉", label: "Customer Portal", path: "/portal" },
  { key: "api", icon: "</>", label: "API & Integrations", path: "/api" },
];

const TITLES: Record<string, [string, string]> = {
  dashboard: ["Operations Dashboard", "live · all departments"],
  quoting: ["Quoting", "AI drawing scan for reference · price and track quotes"],
  salesOrders: ["Sales Orders", "manual entry or scan a PO · contract review · converts to work orders"],
  customers: ["Customers", "accounts referenced by orders, jobs, and invoices"],
  planning: ["Planning", "complete the traveler for jobs needing planning · templates & part-specific plans"],
  travelers: ["Job Travelers", "paperless routers · rev-controlled"],
  shopfloor: ["Shop Floor Execution", "operator terminal"],
  chemistry: ["Bath Chemistry & Solution Control", "Nadcap AC7108 solution analysis"],
  compliance: ["Quality & Compliance", "NCR · CAPA · audit readiness"],
  certs: ["Certifications", "C of C generation & release"],
  invoicing: ["Invoicing", "QuickBooks Online sync"],
  calibration: ["Equipment & Calibration", "ISO 10012 controlled instruments"],
  inventory: ["Chemical Inventory", "lot-traced consumables"],
  vendors: ["Approved Vendors", "AS9100 §8.4 external providers"],
  documents: ["Document Control", "controlled QMS documents"],
  portal: ["Customer Portal", "external view preview"],
  api: ["API & Integrations", "erp.texasprecision.net/api/v1"],
};

function useBadges(): Record<string, string> {
  const dash = useDashboard();
  const orders = useOrders();
  const tanks = useTanks();
  const ncrs = useNcrs();
  const certs = useCertQueue();
  const invoices = useInvoices();
  const equipment = useEquipment();
  const inventory = useInventory();
  const planningQueue = usePlanningQueue();

  const openNcrs = ncrs.data?.filter((n) => n.disposition !== "Closed").length ?? undefined;
  const heldTanks = tanks.data?.filter((t) => t.held).length ?? undefined;
  const overdueEq = equipment.data?.filter((e) => e.due_at && new Date(e.due_at) < new Date()).length ?? undefined;
  const readyCerts = certs.data?.filter((c) => c.ready).length ?? undefined;
  const unsyncedInv = invoices.data?.filter((i) => i.qb_sync_status !== "Synced").length ?? undefined;
  const attention = inventory.data?.filter((i) => {
    const status = i.expires_at && new Date(i.expires_at) < new Date() ? "Expired" : i.on_hand_qty <= i.reorder_at_qty ? "Reorder" : "OK";
    return status !== "OK";
  }).length ?? undefined;
  const quoteCount = orders.data?.filter((o) => o.kind === "quote").length ?? undefined;
  const orderCount = orders.data?.filter((o) => o.kind === "order").length ?? undefined;

  return {
    quoting: quoteCount !== undefined ? String(quoteCount) : "",
    salesOrders: orderCount !== undefined ? String(orderCount) : "",
    planning: planningQueue.data ? String(planningQueue.data.length) : "",
    travelers: dash.data ? dash.data.kpis.find((k) => k.key === "wip")?.value ?? "" : "",
    chemistry: heldTanks !== undefined ? String(heldTanks) : "",
    compliance: openNcrs !== undefined ? String(openNcrs) : "",
    certs: readyCerts !== undefined ? String(readyCerts) : "",
    invoicing: unsyncedInv !== undefined ? String(unsyncedInv) : "",
    calibration: overdueEq !== undefined ? String(overdueEq) : "",
    inventory: attention !== undefined ? String(attention) : "",
  };
}

export function Layout({ children, showItarBanner = true }: { children: ReactNode; showItarBanner?: boolean }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const badges = useBadges();
  const activeKey = NAV_ITEMS.find((n) => location.pathname.startsWith(n.path))?.key ?? "dashboard";
  const [title, sub] = TITLES[activeKey] ?? TITLES.dashboard;

  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <nav style={{ width: 216, flexShrink: 0, background: colors.sidebarBg, display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ padding: "18px 16px 14px 16px", borderBottom: `1px solid ${colors.sidebarBorder}` }}>
          {/* The brand block doubles as the way home to Finishing Control, which is
              the app's landing page — otherwise the ERP is a one-way trip. */}
          <Link to="/finishing" style={{ textDecoration: "none" }} title="Back to Finishing Control">
            <div style={{ fontSize: 15, fontWeight: 700, color: "#FFFFFF", letterSpacing: "0.02em" }}>TPP ERP</div>
          </Link>
          <div style={{ fontFamily: fontMono, fontSize: 10, color: "#6E7B84", marginTop: 3 }}>NADCAP · AS9100D · ITAR</div>
        </div>
        <div style={{ padding: "8px 0", flex: 1 }}>
          {NAV_ITEMS.map((nv) => {
            const active = nv.key === activeKey;
            const badge = badges[nv.key];
            return (
              <NavLink
                key={nv.key}
                to={nv.path}
                className="nav-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? "#FFFFFF" : colors.sidebarTextInactive,
                  background: active ? colors.sidebarActiveBg : "transparent",
                  borderLeft: `3px solid ${active ? colors.accentDefault : "transparent"}`,
                  textDecoration: "none",
                }}
              >
                <span style={{ width: 18, textAlign: "center", fontFamily: fontMono, fontSize: 11, color: active ? colors.sidebarIconActive : colors.sidebarIconInactive }}>
                  {nv.icon}
                </span>
                <span>{nv.label}</span>
                {badge ? (
                  <span
                    style={{
                      marginLeft: "auto",
                      fontFamily: fontMono,
                      fontSize: 10,
                      background: colors.sidebarBadgeBg,
                      color: colors.sidebarBadgeText,
                      padding: "1px 6px",
                      borderRadius: 8,
                    }}
                  >
                    {badge}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </div>
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${colors.sidebarBorder}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: colors.accentDefault, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600 }}>
            {user?.initials ?? "MT"}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#E8ECEE" }}>{user?.name ?? "M. Torres"}</div>
            <div style={{ fontSize: 10, color: "#6E7B84" }}>{user?.role ?? "Quality Manager"}</div>
          </div>
          <button
            onClick={logout}
            title="Log out"
            style={{ background: "transparent", border: "none", color: "#6E7B84", cursor: "pointer", fontSize: 14 }}
          >
            ⏻
          </button>
        </div>
      </nav>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {showItarBanner ? (
          <div
            style={{
              background: colors.itarBg,
              color: colors.itarText,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textAlign: "center",
              padding: "5px 0",
              flexShrink: 0,
            }}
          >
            ITAR CONTROLLED — U.S. PERSONS ONLY · EXPORT CONTROLLED TECHNICAL DATA
          </div>
        ) : null}

        <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 24px", background: colors.headerBg, borderBottom: `1px solid ${colors.headerBorder}`, flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h1>
          <span style={{ fontFamily: fontMono, fontSize: 11, color: colors.textFaint }}>{sub}</span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            <input
              placeholder="Search jobs, POs, parts…"
              style={{ border: `1px solid ${colors.headerBorder}`, borderRadius: 5, padding: "7px 12px", fontSize: 12, width: 240, fontFamily: fontSans }}
            />
            <div style={{ fontFamily: fontMono, fontSize: 11, color: colors.textFaint }}>{today}</div>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>{children}</div>
      </main>
    </div>
  );
}
