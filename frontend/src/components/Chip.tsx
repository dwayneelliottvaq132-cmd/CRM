import { chip, fontSans, type ChipKind } from "../lib/theme";

export function Chip({ kind, text }: { kind: ChipKind; text: string }) {
  const c = chip(kind);
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        background: c.bg,
        color: c.color,
        padding: "2px 8px",
        borderRadius: 9,
        fontFamily: fontSans,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

export function SmallChip({ kind, text }: { kind: ChipKind; text: string }) {
  const c = chip(kind);
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        background: c.bg,
        color: c.color,
        padding: "1px 6px",
        borderRadius: 8,
      }}
    >
      {text}
    </span>
  );
}

export function ItarBadge() {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.06em",
        background: "#3B2F1E",
        color: "#E3C98A",
        padding: "2px 8px",
        borderRadius: 3,
      }}
    >
      ITAR
    </span>
  );
}
