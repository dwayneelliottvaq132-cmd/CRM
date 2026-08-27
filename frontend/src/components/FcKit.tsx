import type { CSSProperties, ReactNode } from "react";
import { OCHRE, chip } from "../pages/finishing/designData";

/** Finishing Control's visual language, as reusable primitives for ERP pages.
 *
 *  The tokens come from `pages/finishing/designData.ts` — the verbatim port of the
 *  Claude Design source — so these stay in step with the design rather than drifting
 *  into a third look. Pages that live in the ERP shell (Layout's dark sidebar) can
 *  use these for their content area; the shell itself is untouched.
 *
 *  This is deliberately NOT `lib/theme.ts`. That is the original ERP language (IBM
 *  Plex, its own palette) and the pre-existing screens still use it. */

export const MONO = "'Space Mono',monospace";
export const SANS = "'Space Grotesk',sans-serif";

export const FC = {
  ink: "#16161A",
  body: "#4A4A52",
  muted: "#6B6B72",
  faint: "#9A9AA2",
  line: "#E1E1E4",
  surface: "#FFFFFF",
  wash: "#F4F4F5",
  gold: OCHRE,
  goldWash: "#FAF6EC",
  goldLine: "#EADFC4",
  red: "#B3261E",
  green: "#1E6B4E",
} as const;

export const fcChip = chip;

/** Small uppercase mono label — the design's field-caption treatment. */
export function FcLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", color: FC.faint, textTransform: "uppercase", ...style }}>
      {children}
    </div>
  );
}

export function FcCard({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: FC.surface, border: `1px solid ${FC.line}`, borderRadius: 5, ...style }}>{children}</div>
  );
}

export function FcCardHeader({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <div style={{ padding: "14px 18px", borderBottom: `1px solid ${FC.line}` }}>
      <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: FC.ink, letterSpacing: "-0.01em" }}>{title}</div>
      {sub ? <div style={{ fontFamily: MONO, fontSize: 10.5, color: FC.muted, marginTop: 3 }}>{sub}</div> : null}
    </div>
  );
}

export function FcField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <FcLabel style={{ marginBottom: 5 }}>{label}</FcLabel>
      {children}
      {hint ? <div style={{ fontFamily: MONO, fontSize: 9.5, color: FC.faint, marginTop: 4 }}>{hint}</div> : null}
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: MONO,
  fontSize: 11.5,
  color: FC.ink,
  background: FC.surface,
  border: `1px solid ${FC.line}`,
  borderRadius: 4,
  padding: "7px 9px",
  outline: "none",
};

export function FcInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { style, ...rest } = props;
  return <input {...rest} style={{ ...inputStyle, ...style }} />;
}

export function FcSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { style, children, ...rest } = props;
  return (
    <select {...rest} style={{ ...inputStyle, ...style }}>
      {children}
    </select>
  );
}

/** Mono pill button. `tone`: solid ink for the primary action, outline otherwise,
 *  red outline for anything destructive. Mirrors the design's BTN treatment. */
export function FcButton({
  tone = "outline",
  children,
  style,
  ...rest
}: { tone?: "primary" | "outline" | "danger" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const tones: Record<string, CSSProperties> = {
    primary: { background: FC.ink, color: "#FFFFFF", border: `1px solid ${FC.ink}` },
    outline: { background: FC.surface, color: FC.body, border: `1px solid ${FC.line}` },
    danger: { background: FC.surface, color: FC.red, border: "1px solid #F0CFCB" },
  };
  return (
    <button
      {...rest}
      style={{
        fontFamily: MONO,
        fontSize: 10.5,
        letterSpacing: "0.04em",
        padding: "5px 11px",
        borderRadius: 3,
        cursor: rest.disabled ? "default" : "pointer",
        opacity: rest.disabled ? 0.45 : 1,
        ...tones[tone],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** Inline chip using the design's own chip() so colours match /finishing exactly. */
export function FcChip({ text, kind }: { text: string; kind: "ready" | "open" | "review" | "grey" | "info" }) {
  const kinds = {
    ready: chip(FC.green, "#EFF7F3", "#C9E3D8"),
    open: chip(FC.red, "#FFF1F0", "#F0CFCB"),
    review: chip(FC.gold, FC.goldWash, FC.goldLine),
    info: chip("#2B4C8C", "#EFF3FB", "#CBD8EF"),
    grey: chip(FC.muted, "#F4F4F5", FC.line),
  };
  return <span style={sxChip(kinds[kind])}>{text}</span>;
}

/** designData's chip() returns a CSS declaration string; convert for React. */
function sxChip(css: string): CSSProperties {
  const out: Record<string, string> = {};
  for (const decl of css.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (k && v) out[k.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase())] = v;
  }
  return { display: "inline-block", ...out } as CSSProperties;
}

export function FcBanner({ tone, children }: { tone: "error" | "ok"; children: ReactNode }) {
  const isErr = tone === "error";
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: 10.5,
        lineHeight: 1.5,
        padding: "8px 11px",
        borderRadius: 4,
        marginBottom: 14,
        color: isErr ? FC.red : FC.green,
        background: isErr ? "#FFF8F7" : "#EFF7F3",
        border: `1px solid ${isErr ? "#F5DEDB" : "#C9E3D8"}`,
      }}
    >
      {children}
    </div>
  );
}
