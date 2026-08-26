import type { ReactNode } from "react";
import { colors, fontMono } from "../lib/theme";

export interface Column<T> {
  header: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
  first?: boolean;
  last?: boolean;
}

export function Table<T>({
  columns,
  rows,
  keyFn,
  onRowClick,
  rowBg,
}: {
  columns: Column<T>[];
  rows: T[];
  keyFn: (row: T) => string;
  onRowClick?: (row: T) => void;
  rowBg?: (row: T) => string | undefined;
}) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr>
          {columns.map((c) => (
            <th
              key={c.header}
              style={{
                textAlign: c.align ?? "left",
                padding: c.first ? "10px 16px" : c.last ? "10px 16px" : "10px 8px",
                fontSize: 10,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                color: colors.textFaint,
                fontWeight: 600,
              }}
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={keyFn(row)}
            className={onRowClick ? "row-hover" : undefined}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            style={{ borderTop: `1px solid ${colors.rowBorder}`, cursor: onRowClick ? "pointer" : undefined, background: rowBg?.(row) }}
          >
            {columns.map((c) => (
              <td
                key={c.header}
                style={{
                  padding: c.first ? "9px 16px" : c.last ? "9px 16px" : "9px 8px",
                  textAlign: c.align ?? "left",
                }}
              >
                {c.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#FFFFFF", border: `1px solid ${colors.cardBorder}`, borderRadius: 6, ...style }}>
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${colors.rowBorder}`, fontSize: 13, fontWeight: 700 }}>
      {children}
    </div>
  );
}

export const monoCell: React.CSSProperties = { fontFamily: fontMono };
