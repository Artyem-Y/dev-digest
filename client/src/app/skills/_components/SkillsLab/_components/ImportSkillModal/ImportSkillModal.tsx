"use client";

import React from "react";
import { Button, Card, FormField, Modal, TextInput } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import type { SkillImportInput } from "@/lib/hooks/skills";

type PreviewMutation = { mutate: (input: SkillImportInput) => void; isPending: boolean; data?: Pick<Skill, "name" | "description" | "body"> };
type ImportMutation = { mutate: (input: SkillImportInput & { name?: string; description?: string }, options: { onSuccess: (skill: Skill) => void }) => void; isPending: boolean };

export function ImportSkillModal({ initialMode, preview, save, onClose, onSaved }: { initialMode: "url" | "file"; preview: PreviewMutation; save: ImportMutation; onClose: () => void; onSaved: (skill: Skill) => void }) {
  const [mode, setMode] = React.useState<"url" | "file">(initialMode);
  const [url, setUrl] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [data, setData] = React.useState<SkillImportInput | null>(null);
  const runPreview = async () => {
    const input: SkillImportInput | null = mode === "url" ? url.trim() ? { kind: "url", url: url.trim() } : null : file ? file.name.toLowerCase().endsWith(".zip") ? { kind: "zip", zip_base64: await file.arrayBuffer().then((buffer) => { const bytes = new Uint8Array(buffer); let binary = ""; for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192)); return btoa(binary); }) } : { kind: "markdown", markdown: await file.text() } : null;
    if (!input) return;
    setData(input);
    preview.mutate(input);
  };
  return <Modal width={760} title="Add skill" subtitle="Import a reusable review skill, then preview it before saving." onClose={onClose} footer={<div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Button kind="ghost" onClick={onClose}>Cancel</Button><Button kind="secondary" onClick={runPreview} disabled={preview.isPending || (mode === "url" ? !url.trim() : !file)}>Preview</Button><Button kind="primary" disabled={!data || !preview.data || save.isPending} onClick={() => data && save.mutate({ ...data, name: preview.data!.name, description: preview.data!.description }, { onSuccess: onSaved })}>Import skill</Button></div>}>
    <div role="tablist" style={{ display: "flex", gap: 4, padding: "16px 24px 0", borderBottom: "1px solid var(--border)" }}><button type="button" role="tab" aria-selected={mode === "file"} onClick={() => { setMode("file"); setData(null); }} style={tabStyle(mode === "file")}>From file</button><button type="button" role="tab" aria-selected={mode === "url"} onClick={() => { setMode("url"); setData(null); }} style={tabStyle(mode === "url")}>Import from URL</button></div>
    <div style={{ padding: 24 }}>{mode === "url" ? <FormField label="Public skill URL" hint="Only public HTTPS URLs can be imported."><TextInput aria-label="Skill URL" value={url} placeholder="https://example.com/skill.md" onChange={setUrl} /></FormField> : <FormField label="Skill file" hint="Supported formats: .md, .markdown and .zip"><input aria-label="Skill file" type="file" accept=".md,.markdown,.zip,text/markdown,text/plain,application/zip" onChange={(event) => setFile(event.target.files?.[0] ?? null)} style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border-strong)", borderRadius: 7, background: "var(--bg-elevated)", color: "var(--text-primary)" }} /></FormField>}{preview.data && <Card style={{ padding: 16, background: "var(--bg-surface)" }}><strong>{preview.data.name}</strong><p style={{ color: "var(--text-secondary)", marginTop: 5 }}>{preview.data.description}</p><pre className="mono" style={{ whiteSpace: "pre-wrap", maxHeight: 180, overflow: "auto", marginTop: 12, padding: 12, border: "1px solid var(--border)", borderRadius: 6, background: "var(--code-bg)" }}>{preview.data.body}</pre></Card>}</div>
  </Modal>;
}

function tabStyle(active: boolean): React.CSSProperties {
  return { padding: "10px 12px", border: 0, borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent", background: active ? "var(--accent-bg)" : "transparent", color: active ? "var(--accent-text)" : "var(--text-secondary)", borderRadius: "6px 6px 0 0", fontWeight: 600, cursor: "pointer" };
}
