import type { CSSProperties } from "react";

export const s = {
  descriptionBox: {
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--bg-elevated)",
    padding: 18,
    fontSize: 14,
    color: "var(--text-secondary)",
    whiteSpace: "pre-wrap",
    lineHeight: 1.55,
  } satisfies CSSProperties,
  intentBox: {
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--bg-elevated)",
    padding: 18,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  intentSummary: { margin: "0 0 8px", color: "var(--text-primary)", lineHeight: 1.5 } satisfies CSSProperties,
  intentMeta: { fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
  intentScopes: { display: "flex", gap: 32, flexWrap: "wrap", marginTop: 16 } satisfies CSSProperties,
  scopeTitle: { fontSize: 13, color: "var(--text-primary)" } satisfies CSSProperties,
  scopeList: { margin: "6px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.6 } satisfies CSSProperties,
  intentUnavailable: { fontSize: 14, color: "var(--text-muted)" } satisfies CSSProperties,
} as const;
