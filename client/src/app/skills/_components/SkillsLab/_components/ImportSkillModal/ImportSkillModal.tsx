"use client";

import React from "react";
import { Button, Modal } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import type { SkillImportInput } from "@/lib/hooks/skills";

type PreviewMutation = { mutate: (input: SkillImportInput) => void; isPending: boolean; data?: Pick<Skill, "name" | "description" | "body"> };
type ImportMutation = { mutate: (input: SkillImportInput & { name?: string; description?: string }, options: { onSuccess: (skill: Skill) => void }) => void; isPending: boolean };

export function ImportSkillModal({ preview, save, onClose, onSaved }: { preview: PreviewMutation; save: ImportMutation; onClose: () => void; onSaved: (skill: Skill) => void }) {
  const [mode, setMode] = React.useState<"url" | "file">("url");
  const [url, setUrl] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [data, setData] = React.useState<SkillImportInput | null>(null);
  const runPreview = async () => {
    const input: SkillImportInput | null = mode === "url" ? url.trim() ? { kind: "url", url: url.trim() } : null : file ? file.name.toLowerCase().endsWith(".zip") ? { kind: "zip", zip_base64: await file.arrayBuffer().then((buffer) => { const bytes = new Uint8Array(buffer); let binary = ""; for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192)); return btoa(binary); }) } : { kind: "markdown", markdown: await file.text() } : null;
    if (!input) return;
    setData(input);
    preview.mutate(input);
  };
  return <Modal title="Import skill" subtitle="Preview Markdown, ZIP, or a public HTTPS URL before saving." onClose={onClose} footer={<><Button kind="ghost" onClick={onClose}>Cancel</Button><Button kind="secondary" onClick={runPreview} disabled={preview.isPending}>Preview</Button><Button kind="primary" disabled={!data || !preview.data || save.isPending} onClick={() => data && save.mutate({ ...data, name: preview.data!.name, description: preview.data!.description }, { onSuccess: onSaved })}>Import skill</Button></>}>
    <label><input type="radio" checked={mode === "url"} onChange={() => setMode("url")} /> URL</label><label><input type="radio" checked={mode === "file"} onChange={() => setMode("file")} /> .md / .zip</label>
    {mode === "url" ? <input aria-label="Skill URL" value={url} placeholder="https://example.com/skill.md" onChange={(event) => setUrl(event.target.value)} /> : <input aria-label="Skill file" type="file" accept=".md,.markdown,.zip,text/markdown,text/plain,application/zip" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />}
    {preview.data && <article style={{ border: "1px solid var(--border)", padding: 12, marginTop: 12 }}><strong>{preview.data.name}</strong><p>{preview.data.description}</p><pre style={{ whiteSpace: "pre-wrap", maxHeight: 180, overflow: "auto" }}>{preview.data.body}</pre></article>}
  </Modal>;
}
