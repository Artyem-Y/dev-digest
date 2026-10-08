import { Markdown } from "@devdigest/ui";

export function PreviewTab({ body }: { body: string }) {
  return <article style={{ minHeight: 300, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "var(--bg-surface)" }}><div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: 13 }}>Rendered Markdown preview</div><div style={{ padding: 22 }}><Markdown>{body}</Markdown></div></article>;
}
