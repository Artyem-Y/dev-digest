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
  const [selection, setSelection] = React.useState<{ repoId: string; path: string } | null>(null);
  const selected = selection?.repoId === repoId ? selection.path : !owner ? catalog.data?.find((document) => document.availability === "available")?.path ?? null : null;
  const setSelected = (path: string) => { if (repoId) setSelection({ repoId, path }); };
  const [dragged, setDragged] = React.useState<string | null>(null);
  const preview = useProjectDocument(repoId, selected);
  const rows = owner ? attachments.query.data ?? [] : [];
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
  if (owner) {
    const items = [
      ...rows.map((row) => ({ ...row, attached: true, availability: row.status === "attached" ? "available" : row.status })),
      ...documents.filter((document) => !paths.has(document.path)).map((document) => ({ ...document, attached: false, status: "available" })),
    ].filter((item) => item.path.toLowerCase().includes(search.toLowerCase()));
    return <section className={styles.selector}>
      <div className={styles.selectorHeader}><div className={styles.titleLine}><h2>{t(owner === "skill" ? "skillTitle" : "agentTitle")}</h2><span className={styles.selectorCount}>{t("attached", { count: rows.length, total })}</span></div><label className={styles.search}><span className={styles.srOnly}>{t("search")}</span><input placeholder={t("filter")} value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
      <p className={styles.selectorDescription}>{t(owner === "skill" ? "skillDescription" : "agentDescription")}</p>
      {failed && <p className={styles.alert} role="alert">{t("error")} <button type="button" onClick={() => { void catalog.refetch(); void attachments.query.refetch(); }}>{t("retry")}</button></p>}
      {(attachments.change.isError || attachments.reorder.isError) && <p className={styles.alert} role="alert">{t("error")}</p>}
      {owner === "agent" && resolved.data && <p className={styles.inherited}>{t("inherited")}: {[...resolved.data.documents, ...resolved.data.skipped].filter((item) => item.provenance.includes("linked_skill")).map((item) => item.path).join(", ") || "—"}</p>}
      {catalog.isLoading && <p>{t("loading")}</p>}
      {!catalog.isLoading && !failed && items.length === 0 && <p>{search ? t("noResults") : t("empty")}</p>}
      <div className={styles.selectorList}>{items.map((item) => {
        const index = rows.findIndex((row) => row.path === item.path);
        const parts = item.path.split("/");
        const filename = parts.pop() ?? item.path;
        const type = parts.find((part) => ["specs", "docs", "insights"].includes(part)) ?? "markdown";
        return <React.Fragment key={item.path}><div className={`${styles.selectorRow} ${item.attached ? styles.attachedRow : ""}`} draggable={item.attached} onDragStart={() => setDragged(item.path)} onDragOver={(event) => { if (item.attached) event.preventDefault(); }} onDrop={() => { reorder(rows.findIndex((row) => row.path === dragged), index); setDragged(null); }}>
          <span className={styles.dragHandle} aria-hidden>☰</span>
          <input type="checkbox" className={styles.checkbox} checked={item.attached} aria-label={t(item.attached ? "detach" : "attach", { path: item.path })} disabled={(attachments.change.isPending && attachments.change.variables?.path === item.path) || (!item.attached && item.availability !== "available")} onChange={() => attachments.change.mutate({ path: item.path, attached: !item.attached })} />
          <div className={styles.selectorPath}><span className={styles.filename}>{filename}</span><span className={styles.directory}>{parts.length ? `${parts.join("/")}/` : ""}</span>{item.attached && <span className={styles.meta}>{t("documentTokens", { count: item.estimated_tokens })}</span>}{item.attached && item.status !== "attached" && <span className={styles.warning}>{t("unavailable", { status: item.status })}</span>}</div>
          <span className={`${styles.typeBadge} ${styles[type] ?? ""}`}>{type}</span>
          {item.attached && <div className={styles.selectorOrder}><button type="button" aria-label={t("moveUp", { path: item.path })} disabled={index === 0 || attachments.reorder.isPending} onClick={() => reorder(index, index - 1)}>↑</button><button type="button" aria-label={t("moveDown", { path: item.path })} disabled={index === rows.length - 1 || attachments.reorder.isPending} onClick={() => reorder(index, index + 1)}>↓</button></div>}
          <button className={styles.previewButton} type="button" aria-label={t("preview", { path: item.path })} aria-expanded={selected === item.path} onClick={() => selected === item.path ? setSelection(null) : setSelected(item.path)}><Icon.Eye size={14} />{t("previewLabel")}</button>
        </div>{selected === item.path && <section className={styles.selectorPreview} aria-label={t("preview", { path: item.path })}><div className={styles.previewHeader}><Icon.FileText size={16} /><span>{selected}</span><button type="button" className={styles.closePreview} onClick={() => setSelection(null)} aria-label={t("closePreview")}>×</button></div><div className={styles.previewBody}>{preview.isError ? <p role="alert">{t("error")} <button type="button" onClick={() => { void preview.refetch(); }}>{t("retry")}</button></p> : preview.isLoading ? <p>{t("loading")}</p> : <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{ img: () => null }}>{preview.data?.content ?? ""}</ReactMarkdown>}</div></section>}</React.Fragment>;
      })}</div>
      {owner === "skill" && rows.length > 0 && <div className={styles.serialization}><span>{t("serializesAs")}</span><pre>{`## Project specifications\n${rows.map((row) => `- ${row.path}`).join("\n")}`}</pre></div>}
      <div className={styles.selectorFooter}><span>{t("tokens", { count: rows.reduce((sum, row) => sum + row.estimated_tokens, 0) })}</span><span>{t("untrustedNote")}</span></div>
    </section>;
  }
  if (!owner && !catalog.isLoading && !failed && catalog.data?.length === 0) return <section className={styles.emptyState}><div className={styles.emptyIcon}><Icon.Folder size={24} /></div><h1>{t("emptyTitle")}</h1><p>{t("emptyDescription")}</p></section>;
  return <section className={`${styles.root} ${styles.catalog}`}>
    {failed && <p className={styles.alert} role="alert">{t("error")} <button type="button" onClick={() => { void catalog.refetch(); }}>{t("retry")}</button></p>}
    <div className={styles.workspace}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}><span className={styles.eyebrow}>{t("title")}</span><label className={styles.search}><span className={styles.srOnly}>{t("search")}</span><input placeholder={t("search")} value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
        <div className={styles.list}>
        {catalog.isLoading && <p>{t("loading")}</p>}
        {!catalog.isLoading && !failed && catalog.data?.length === 0 && <p>{t("empty")}</p>}
        {documents.map((document) => <div key={document.path} className={`${styles.row} ${selected === document.path ? styles.selected : ""}`}>
          <button className={styles.document} type="button" aria-label={t("preview", { path: document.path })} aria-pressed={selected === document.path} onClick={() => setSelected(document.path)}><Icon.FileText className={styles.fileIcon} size={13} /><span className={styles.path}>{document.path}</span></button>
        </div>)}
        </div>
      </div>
      <div className={styles.preview}>{!selected ? <div className={styles.placeholder}><Icon.FileText size={24} /><p>{t("previewHint")}</p></div> : <><div className={styles.previewHeader}><Icon.FileText size={16} /><span>{selected}</span><span className={styles.previewBadge}>{t("previewLabel")}</span></div><div className={styles.previewBody}>{preview.isError ? <p role="alert">{t("error")} <button type="button" onClick={() => { void preview.refetch(); }}>{t("retry")}</button></p> : preview.isLoading ? <p>{t("loading")}</p> : <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{ img: () => null }}>{preview.data?.content ?? ""}</ReactMarkdown>}</div></>}</div>
    </div>
  </section>;
}
