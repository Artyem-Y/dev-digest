import { Markdown } from "@devdigest/ui";

export function PreviewTab({ body }: { body: string }) {
  return <article style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 20 }}><Markdown>{body}</Markdown></article>;
}
