import type { ReactNode } from "react";
import { colors, fontSans } from "../lib/theme";

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = 480,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(20, 26, 30, 0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF",
          borderRadius: 8,
          width,
          maxWidth: "calc(100vw - 40px)",
          maxHeight: "calc(100vh - 40px)",
          overflowY: "auto",
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
          fontFamily: fontSans,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${colors.rowBorder}` }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.text }}>{title}</div>
          <button onClick={onClose} title="Close" style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer", fontSize: 16, color: colors.textFaint }}>
            ✕
          </button>
        </div>
        <div style={{ padding: "18px 20px" }}>{children}</div>
        {footer ? (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 20px", borderTop: `1px solid ${colors.rowBorder}` }}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: colors.textFaint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>
        {label}
      </div>
      {children}
      {hint ? <div style={{ fontSize: 10, color: colors.textFaint, marginTop: 3 }}>{hint}</div> : null}
    </label>
  );
}

const controlStyle: React.CSSProperties = {
  width: "100%",
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: 5,
  padding: "8px 10px",
  fontSize: 13,
  fontFamily: fontSans,
  boxSizing: "border-box",
};

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...controlStyle, ...props.style }} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...controlStyle, ...props.style }} />;
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{
        background: colors.accentDefault,
        color: "#FFFFFF",
        border: "none",
        borderRadius: 5,
        padding: "8px 16px",
        fontSize: 12,
        fontWeight: 600,
        cursor: props.disabled ? "default" : "pointer",
        opacity: props.disabled ? 0.6 : 1,
        ...props.style,
      }}
    />
  );
}

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{
        background: "#FFFFFF",
        color: colors.text,
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: 5,
        padding: "8px 16px",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        ...props.style,
      }}
    />
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div style={{ background: "#FBEFEF", border: `1px solid ${colors.red}`, borderRadius: 6, padding: "8px 12px", fontSize: 12, color: colors.red, marginBottom: 14 }}>
      {message}
    </div>
  );
}

export const formLabel: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: colors.textFaint, marginBottom: 4, marginTop: 12 };
export const formInput: React.CSSProperties = { width: "100%", border: `1px solid ${colors.cardBorder}`, borderRadius: 5, padding: "8px 10px", fontSize: 13 };
