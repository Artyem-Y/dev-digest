'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { Activity, Boxes, ChevronDown, Command, Copy, FileText, Link, ListChecks, RefreshCw, Target } from 'lucide-react';
import type { OnboardingTourItem, OnboardingTourSectionId } from '@devdigest/shared';
import { useActiveRepo } from '@/lib/repo-context';
import { readTourFile, useGenerateOnboardingTour, useOnboardingTour } from '@/lib/hooks/onboarding-tour';
import { ArchitectureGraph } from './ArchitectureGraph';

const ids: OnboardingTourSectionId[] = ['architecture', 'critical_paths', 'local_run', 'reading_path', 'first_tasks'];
const icons = { architecture: Boxes, critical_paths: Activity, local_run: Command, reading_path: ListChecks, first_tasks: Target };
const card: CSSProperties = { background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 14, padding: '13px 16px 16px', scrollMarginTop: 16 };
const button: CSSProperties = { background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 7, color: 'inherit', cursor: 'pointer', padding: '7px 12px' };
const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-surface)', borderRadius: 7, padding: '8px 11px', marginTop: 7, minWidth: 0, fontSize: 12 };
const text: CSSProperties = { overflowWrap: 'anywhere', minWidth: 0, flex: 1 };

export function OnboardingTour({ repoId }: { repoId: string }) {
  const t = useTranslations('onboarding-tour');
  const { activeRepo } = useActiveRepo();
  const query = useOnboardingTour(repoId);
  const generate = useGenerateOnboardingTour(repoId);
  const [activeSection, setActiveSection] = useState<OnboardingTourSectionId>('architecture');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState('');
  const [allReading, setAllReading] = useState(false);
  const [file, setFile] = useState<{ path: string; content: string } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => { if (file) closeRef.current?.focus(); }, [file]);
  const closeFile = () => { setFile(null); returnFocus.current?.focus(); };
  const tour = query.data?.tour;
  const attempt = query.data?.attempt;
  const pending = generate.isPending || attempt?.status === 'pending';
  useEffect(() => {
    if (!tour || typeof IntersectionObserver === 'undefined') return;
    const targets = ids.map((id) => document.getElementById(`tour-${id}`)).filter((element): element is HTMLElement => element !== null);
    const visible = new Set<string>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      }
      const first = ids.find((id) => visible.has(`tour-${id}`));
      if (first) setActiveSection(first);
    }, { root: targets[0]?.closest('main') ?? null, rootMargin: '0px 0px -65% 0px', threshold: 0 });
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [tour]);
  const sections = ids.map((id) => tour?.sections.find((section) => section.id === id) ?? { id, items: [], narrative: [], unavailable_reason: null });
  const knownPaths = new Set(sections.flatMap((section) => section.items.filter((item) => item.kind === 'path').map((item) => item.text)));
  const copy = async (value: string) => { setFeedback(''); try { await navigator.clipboard.writeText(value); setFeedback(t('copied')); } catch { setFeedback(t('copyFailed')); } };
  const open = async (path: string) => {
    if (!tour?.source_revision || !knownPaths.has(path)) { setFeedback(t('fileFailed')); return; }
    try { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setFile(await readTourFile(repoId, path, tour.source_revision)); } catch { setFeedback(t('fileFailed')); }
  };
  const format = (value: number | null | undefined) => value == null ? t('unavailable') : String(value);
  const openButton = (path: string) => tour?.source_revision && knownPaths.has(path) ? <button style={button} aria-label={`${t('open')}: ${path}`} onClick={() => void open(path)}>{t('open')}</button> : null;
  const renderItems = (id: OnboardingTourSectionId, items: OnboardingTourItem[]) => {
    if (id === 'architecture') {
      const edges = items.filter((item) => item.kind === 'dependency' && item.text.split(' -> ').length === 2);
      const rest = items.filter((item) => !edges.includes(item));
      const graphEdges = edges.map((item) => { const [from, to] = item.text.split(' -> '); return { from: from!, to: to!, key: item.fact_ids.join(':') }; });
      const documented = edges.some((item) => item.fact_ids.some((id) => id.startsWith('architecture:')));
      return <>{rest.map((item, i) => <p key={i} style={{ color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>{item.text}</p>)}{graphEdges.length > 0 && <><p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{documented ? t('documentedArchitecture') : t('indexedImports')}</p><ArchitectureGraph edges={graphEdges} label={t('architectureGraph')} /><details style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 12 }}><summary>{t('allDependencies', { count: edges.length })}</summary><ul style={{ maxHeight: 200, overflowY: 'auto' }}>{edges.map((edge) => <li key={edge.fact_ids.join(':')}><code style={{ overflowWrap: 'anywhere' }}>{edge.text}</code></li>)}</ul></details></>}</>;
    }
    if (id === 'critical_paths') return <div><p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{t('criticalPathsExplanation')}</p>{items.map((item, i) => { const first = item.kind === 'path' ? item.text : item.text.split(' -> ')[0] ?? ''; return <div key={i} style={row}><FileText size={16} aria-hidden="true" color="var(--text-muted)" /><code style={text}>{item.text}</code>{openButton(first)}</div>; })}</div>;
    if (id === 'local_run') return <ol aria-label={t('localCommands')} style={{ listStyle: 'none', padding: 0, margin: 0 }}>{items.map((item, i) => <li key={i} style={{ ...row, background: 'var(--bg-primary)', border: '1px solid var(--border)', padding: '9px 12px' }}><span style={{ color: 'var(--text-muted)', width: 14 }}>{i + 1}</span><code style={{ ...text, color: 'var(--text-primary)' }}>{item.text}</code>{item.kind === 'command' && <button style={{ ...button, border: 0, padding: 4, color: 'var(--text-muted)' }} aria-label={`${t('copy')}: ${item.text}`} onClick={() => void copy(item.text)}><Copy size={14} /></button>}</li>)}</ol>;
    if (id === 'reading_path') return <><ol aria-label={t('readingList')} style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>{(allReading ? items : items.slice(0, 5)).map((item, i) => <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}><span style={{ width: 20, height: 20, borderRadius: 99, background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{i + 1}</span><div style={text}><code style={{ color: 'var(--accent)', fontSize: 12 }}>{item.text}</code>{item.description && <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>{item.description}</div>}</div>{item.kind === 'path' && openButton(item.text)}</li>)}</ol>{items.length > 5 && <button type="button" style={{ ...button, marginTop: 12, fontSize: 12 }} aria-expanded={allReading} onClick={() => setAllReading(!allReading)}>{allReading ? t('showFewerFiles') : t('showAllFiles', { count: items.length })}</button>}</>;
    return <ul className="tour-tasks" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>{items.map((item, i) => <li key={i} style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', borderRadius: 8, padding: 12, fontSize: 13, fontWeight: 600, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{item.text}</li>)}</ul>;
  };
  if (!query.isLoading && !query.isError && !tour && !pending && !generate.isError && !attempt?.reason) {
    return <div style={{ minHeight: 480, display: 'grid', placeItems: 'center', padding: 32 }}><div style={{ maxWidth: 430, textAlign: 'center' }}><div style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--accent-bg)', color: 'var(--accent)', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}><Boxes size={24} /></div><h1 style={{ fontSize: 20, margin: '0 0 8px' }}>{t('generate')}</h1><p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, margin: '0 0 20px' }}>{t('empty')}</p><button style={{ ...button, background: 'var(--accent)', color: '#fff', fontWeight: 600 }} onClick={() => generate.mutate()}>{t('generate')}</button></div></div>;
  }
  return <div className="tour-layout" style={{ display: 'flex', gap: 28, padding: '24px 28px 40px', maxWidth: 1080, margin: '0 auto' }}>
    <nav className="tour-nav" aria-label={t('onThisPage')} style={{ width: 180, flexShrink: 0, position: 'sticky', top: 16, alignSelf: 'flex-start' }}><div style={{ color: 'var(--text-muted)', fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>{t('onThisPage')}</div>{ids.map((id) => <a key={id} href={`#tour-${id}`} onClick={() => { setActiveSection(id); setExpanded((current) => ({ ...current, [id]: true })); }} style={{ display: 'block', color: activeSection === id ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 12.5, fontWeight: activeSection === id ? 600 : 500, borderLeft: activeSection === id ? '2px solid var(--accent)' : '2px solid transparent', padding: '5px 11px', textDecoration: 'none' }}>{t(id)}</a>)}</nav>
    <div style={{ flex: 1, minWidth: 0 }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}><div><h1 style={{ margin: 0, fontSize: 24, letterSpacing: '-.02em' }}>{t('title')} <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono), monospace' }}>{activeRepo?.name ?? repoId}</span></h1>{tour && <p style={{ color: 'var(--text-muted)', fontSize: 12.5, marginTop: 5 }}>{t('files')}: {format(tour.counts.indexed_files)} · {t('generatedAt')}: {new Date(tour.generated_at).toLocaleString()}</p>}</div><div style={{ display: 'flex', gap: 8, alignItems: 'start' }}><button data-testid="tour-generate" style={{ ...button, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }} disabled={pending} onClick={() => generate.mutate()}><RefreshCw size={14} />{tour ? t('regenerate') : t('generate')}</button><button data-testid="tour-share" style={{ ...button, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }} onClick={() => void copy(window.location.href)}><Link size={14} />{t('share')}</button></div></header>
      <div aria-live="polite">{feedback}</div>
      {query.isLoading && <p role="status">{t('loading')}</p>}{query.isError && <p role="alert">{t('loadError')}</p>}{pending && <p role="status">{t('pending')}</p>}
      {(generate.isError || attempt?.status === 'failed' || attempt?.status === 'cancelled' || (attempt?.status === 'partial' && attempt.reason)) && <p role="alert">{t('failure')} {attempt?.reason && <span>{t(`reasons.${attempt.reason}`)}</span>}</p>}
      {!query.isLoading && !query.isError && !tour && !pending && <p>{t('empty')}</p>}
      {tour && <details style={{ marginBottom: 14, color: 'var(--text-secondary)', fontSize: 12.5 }}><summary style={{ cursor: 'pointer' }}><strong>{t(tour.status)}</strong> · {t('freshness')}: {tour.freshness} · {t('calls')}: {format((attempt?.usage ?? tour.usage).call_count)} · {t('cost')}: {format((attempt?.usage ?? tour.usage).cost_usd)}</summary><div style={{ padding: '8px 0', lineHeight: 1.6 }}>{t('source')}: {tour.source_revision ?? t('unavailable')}<br />{t('files')}: {format(tour.counts.indexed_files)} · {t('omitted')}: {format(tour.counts.omitted_files)} · {t('inputTokens')}: {format((attempt?.usage ?? tour.usage).input_tokens)} · {t('outputTokens')}: {format((attempt?.usage ?? tour.usage).output_tokens)}{tour.limitations.length > 0 && <p>{t('limitations')}: {tour.limitations.join(' · ')}</p>}</div></details>}
      {sections.map((section) => { const Icon = icons[section.id]; const isOpen = expanded[section.id] !== false; return <section key={section.id} id={`tour-${section.id}`} style={card}><button type="button" aria-expanded={isOpen} aria-controls={`tour-panel-${section.id}`} onClick={() => setExpanded((current) => ({ ...current, [section.id]: current[section.id] === false }))} style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14.5, background: 'transparent', color: 'inherit', border: 0, width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 7, background: 'var(--accent-bg)', color: 'var(--accent)' }}><Icon size={15} /></span><span style={{ flex: 1 }}>{t(section.id)}</span><ChevronDown size={16} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', color: 'var(--text-muted)' }} /></button><div id={`tour-panel-${section.id}`} hidden={!isOpen} style={{ marginTop: 12 }}>{(section.narrative?.length ?? 0) > 0 && <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, lineHeight: 1.6, overflowWrap: 'anywhere' }}>{section.narrative!.map((sentence) => sentence.text).join(' ')}</p>}{section.items.length ? renderItems(section.id, section.items) : !(section.narrative?.length) && <p style={{ color: 'var(--text-muted)' }}>{section.unavailable_reason ?? t('notAvailable')}</p>}</div></section>; })}
      {file && <section role="dialog" aria-modal="true" onKeyDown={(event) => { if (event.key === 'Escape') closeFile(); if (event.key === 'Tab') { event.preventDefault(); closeRef.current?.focus(); } }} style={{ ...card, position: 'fixed', inset: '10% 12%', zIndex: 50, overflow: 'auto', boxShadow: '0 0 0 100vmax rgba(0,0,0,.65)' }} aria-label={file.path}><div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>{file.path}</strong><button ref={closeRef} style={button} onClick={closeFile}>{t('close')}</button></div><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{file.content}</pre></section>}
    </div><style>{`@media (max-width: 850px) { .tour-layout { flex-direction: column; padding: 20px !important; } .tour-nav { width: 100% !important; position: static !important; } .tour-tasks { grid-template-columns: 1fr !important; } }`}</style>
  </div>;
}
