import type { CSSProperties } from "react";

/** Parses a CSS declaration string ("color:red; font-size:11px") into a React style
 *  object. The design ships every style as a string, so keeping them verbatim and
 *  converting at render time is far less error-prone than hand-transcribing them. */
export function sx(css: string | undefined): CSSProperties {
  const out: Record<string, string> = {};
  if (!css) return out as CSSProperties;
  for (const decl of css.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const key = decl.slice(0, i).trim();
    const val = decl.slice(i + 1).trim();
    if (!key || !val) continue;
    out[key.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase())] = val;
  }
  return out as CSSProperties;
}
