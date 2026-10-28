"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useActiveRepo } from "@/lib/repo-context";
import { useProjectAttachments, useProjectDocument, useProjectDocuments, useResolvedProjectContext } from "@/lib/hooks/project-context";
import styles from "./ProjectContext.module.css";

export function ProjectContext({ owner, ownerId }: { owner?: "agent" | "skill"; ownerId?: string }) {
  const t = useTranslations("project-context");
  const { repoId } = useActiveRepo();
  const catalog = useProjectDocuments(repoId);
  const attachments = useProjectAttachments(owner && ownerId ? repoId : null, owner ?? "agent", ownerId ?? "");
  const resolved = useResolvedProjectContext(repoId, owner === "agent" ? ownerId ?? null : null);
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(null);
  const [dragged, setDragged] = React.useState<string | null>(null);
  const preview = useProjectDocument(repoId, selected);
  const rows = attachments.query.data ?? [];
  const paths = new Set(rows.map((row) => row.path));
  const total = new Set([...(catalog.data ?? []).map((item) => item.path), ...paths]).size;
  const documents = (catalog.data ?? []).filter((document) => document.path.toLowerCase().includes(search.toLowerCase()));
  const reorder = (from: number, to: number) => {
    if (from < 0 || to < 0 || to >= rows.length || from === to) return;
    const next = rows.map((row) => row.path);
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    attachments.reorder.mutate(next);
  };
  if (!repoId) return <p>{t("noRepo")}</p>;
  const failed = catalog.isError || (!!owner && attachments.query.isError);
  return <section className={styles.root}>
    <header className={styles.heading}><div><h2>{t("title")}</h2><p>{t("description")}</p></div>
      {owner && <span className={styles.count}>{t("attached", { count: rows.length, total })}</span>}
    </header>
    {failed && <p className={styles.alert} role="alert">{t("error")} <button type="button" onClick={() => { void catalog.refetch(); if (owner) void attachments.query.refetch(); }}>{t("retry")}</button></p>}
    {(attachments.change.isError || attachments.reorder.isError) && <p className={styles.alert} role="alert">{t("error")}</p>}
    {owner === "agent" && resolved.data && <p className={styles.inherited}>{t("inherited")}: {[...resolved.data.documents, ...resolved.data.skipped].filter((item) => item.provenance.includes("linked_skill")).map((item) => item.path).join(", ") || "—"}</p>}
    <div className={styles.workspace}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}><span className={styles.eyebrow}>{t("title")}</span><label className={styles.search}><span className={styles.srOnly}>{t("search")}</span><input placeholder={t("search")} value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
        <div className={styles.list}>
        {catalog.isLoading && <p>{t("loading")}</p>}
        {!catalog.isLoading && !failed && catalog.data?.length === 0 && <p>{t("empty")}</p>}
        {owner && rows.map((row, index) => row.path.toLowerCase().includes(search.toLowerCase()) && <div key={row.path} draggable onDragStart={() => setDragged(row.path)} onDragOver={(event) => event.preventDefault()} onDrop={() => { reorder(rows.findIndex((item) => item.path === dragged), index); setDragged(null); }} className={`${styles.row} ${selected === row.path ? styles.selected : ""}`}>
          <button className={styles.document} type="button" onClick={() => setSelected(row.path)}><span className={styles.path}>{row.path}</span><span className={styles.meta}>{t("documentTokens", { count: row.estimated_tokens })}</span>{row.status !== "attached" && <span className={styles.warning}>{t("unavailable", { status: row.status })}</span>}</button>
          <div className={styles.actions}><button type="button" aria-label={t("moveUp", { path: row.path })} disabled={index === 0 || attachments.reorder.isPending} onClick={() => reorder(index, index - 1)}>↑</button>
          <button type="button" aria-label={t("moveDown", { path: row.path })} disabled={index === rows.length - 1 || attachments.reorder.isPending} onClick={() => reorder(index, index + 1)}>↓</button>
          <button type="button" aria-label={t("detach", { path: row.path })} disabled={attachments.change.isPending} onClick={() => attachments.change.mutate({ path: row.path, attached: false })}>×</button></div>
        </div>)}
        {documents.filter((document) => !paths.has(document.path)).map((document) => <div key={document.path} className={`${styles.row} ${selected === document.path ? styles.selected : ""}`}>
          <button className={styles.document} type="button" aria-label={t("preview", { path: document.path })} onClick={() => setSelected(document.path)}><span className={styles.path}>{document.path}</span><span className={styles.meta}>{t("documentTokens", { count: document.estimated_tokens })}</span></button>
          {owner && <div className={styles.actions}><button type="button" aria-label={t("attach", { path: document.path })} disabled={document.availability !== "available" || attachments.change.isPending} onClick={() => attachments.change.mutate({ path: document.path, attached: true })}>+</button></div>}
        </div>)}
        </div>
        {owner && <div className={styles.footer}>{t("tokens", { count: rows.reduce((sum, row) => sum + row.estimated_tokens, 0) })}</div>}
      </div>
      <div className={styles.preview}>{!selected ? <div className={styles.placeholder}><Icon.FileText size={24} /><p>{t("previewHint")}</p></div> : <><div className={styles.previewHeader}><Icon.FileText size={16} /><span>{selected}</span><span className={styles.previewBadge}>{t("previewLabel")}</span></div><div className={styles.previewBody}>{preview.isError ? <p role="alert">{t("error")}</p> : preview.isLoading ? <p>{t("loading")}</p> : <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{ img: () => null }}>{preview.data?.content ?? ""}</ReactMarkdown>}</div></>}</div>
    </div>
  </section>;
}
