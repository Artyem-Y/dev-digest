import type { CSSProperties } from "react";

/** Co-located styles for FindingsPanel (extracted from inline styles). */
export const s = {
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  divider: {
    width: 1,
    height: 18,
    background: "var(--border)",
    margin: "0 2px",
  } satisfies CSSProperties,
  toggleGroup: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  severityFilters: { display: "flex", gap: 6, flexWrap: "wrap" } satisfies CSSProperties,
  severityFilter: (selected: boolean): CSSProperties => ({
    border: "1px solid var(--border-strong)",
    borderRadius: 5,
    padding: "4px 7px",
    background: selected ? "var(--bg-hover)" : "transparent",
    color: "var(--text-secondary)",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
  }),
  categoryFilter: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)" } satisfies CSSProperties,
  categorySelect: { background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: 5, color: "var(--text-primary)", padding: "4px 6px" } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 12 } satisfies CSSProperties,
} as const;
