export const fontSans = "'IBM Plex Sans', 'Helvetica Neue', sans-serif";
export const fontMono = "'IBM Plex Mono', monospace";

export const colors = {
  pageBg: "#F2F3F1",
  text: "#22282C",
  textMuted: "#5E686E",
  textFaint: "#7A848A",

  sidebarBg: "#1B2228",
  sidebarBorder: "#2A333B",
  sidebarActiveBg: "#252F37",
  sidebarTextInactive: "#9BA6AD",
  sidebarTextActive: "#FFFFFF",
  sidebarIconInactive: "#5B6870",
  sidebarIconActive: "#7FA8C4",
  sidebarBadgeBg: "#2A333B",
  sidebarBadgeText: "#8FA0AB",

  headerBg: "#FFFFFF",
  headerBorder: "#DDE0DC",

  cardBorder: "#DDE0DC",
  cardBorderHover: "#B9C0BB",
  rowBorder: "#EAECE8",
  rowHoverBg: "#F6F8F5",

  itarBg: "#3B2F1E",
  itarText: "#E3C98A",

  red: "#A8402F",
  amber: "#A8752B",
  green: "#3D7A4E",
  gray: "#7A848A",

  accentDefault: "#34698C",
} as const;

export type ChipKind = "good" | "warn" | "bad" | "info" | "neutral" | "dark";

const chipMap: Record<ChipKind, { bg: string; color: string }> = {
  good: { bg: "#E2EEE4", color: "#2F5F3C" },
  warn: { bg: "#F4E9D4", color: "#7A5A1E" },
  bad: { bg: "#F3DEDA", color: "#8A3325" },
  info: { bg: "#DFE9F1", color: "#2C5674" },
  neutral: { bg: "#EAECE8", color: "#5E686E" },
  dark: { bg: "#3B2F1E", color: "#E3C98A" },
};

export function chip(kind: ChipKind) {
  return chipMap[kind] ?? chipMap.neutral;
}

/** Generic fallback for status strings without a dedicated map below (documents, vendors, tanks…). */
export function statusKind(status: string): ChipKind {
  const s = status.toLowerCase();
  if (s.includes("hold") || s.includes("overdue") || s.includes("blocked") || s === "expired lot" || s === "held — ooc") return "bad";
  if (s.includes("queued") || s === "draft" || s === "not synced" || s === "pending" || s.includes("obsolete")) return "neutral";
  if (s.includes("due") || s.includes("review") || s.includes("reorder") || s.includes("expiring") || s.includes("conditional") || s.includes("quote")) return "warn";
  if (s.includes("progress") || s.includes("process") || s.includes("syncing") || s === "inspecting") return "info";
  return "good";
}

/** Job / order / quote status → chip kind, matching the mockup's explicit per-status color choices. */
const JOB_ORDER_STATUS: Record<string, ChipKind> = {
  "In Process": "info",
  Queued: "neutral",
  "Final Inspect": "good",
  "Hold — NCR": "bad",
  Inspecting: "good",
  Complete: "good",
  Shipped: "good",
  Converted: "good",
  "Quote — Sent": "warn",
  "Quote — Draft": "warn",
  "Quote — Review": "warn",
};
export function jobOrderStatusKind(status: string): ChipKind {
  return JOB_ORDER_STATUS[status] ?? statusKind(status);
}

const ROUTING_REVISION_STATUS: Record<string, ChipKind> = { Draft: "neutral", Released: "good", Superseded: "warn", Obsolete: "bad" };
export function routingStatusKind(status: string): ChipKind {
  return ROUTING_REVISION_STATUS[status] ?? "neutral";
}

const INVOICE_STATUS: Record<string, ChipKind> = { Draft: "neutral", Sent: "info", Paid: "good", Overdue: "bad" };
export function invoiceStatusKind(status: string): ChipKind {
  return INVOICE_STATUS[status] ?? "neutral";
}

const NCR_DISPOSITION: Record<string, ChipKind> = { "Open — MRB": "bad", Rework: "warn", "Process NCR": "warn", Closed: "good" };
export function ncrDispositionKind(disposition: string): ChipKind {
  return NCR_DISPOSITION[disposition] ?? "neutral";
}

const CAPA_PHASE: Record<string, ChipKind> = { Verify: "info", Implement: "warn", Closed: "good" };
export function capaPhaseKind(phase: string): ChipKind {
  return CAPA_PHASE[phase] ?? "neutral";
}

export function certStateKind(state: string): ChipKind {
  if (state.startsWith("Blocked")) return "bad";
  if (state === "Ready to issue") return "info";
  if (state.startsWith("Issued")) return "good";
  if (state === "Awaiting final insp." || state.endsWith("unsigned")) return "warn";
  return "neutral";
}
