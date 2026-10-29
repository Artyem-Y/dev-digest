import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '../../../../../../messages/en/onboarding-tour.json';
const mocks = vi.hoisted(() => ({ query: vi.fn(), mutation: vi.fn(), repo: vi.fn(), readFile: vi.fn() }));
vi.mock('@/lib/hooks/onboarding-tour', () => ({ useOnboardingTour: mocks.query, useGenerateOnboardingTour: mocks.mutation, readTourFile: mocks.readFile }));
vi.mock('@/lib/repo-context', () => ({ useActiveRepo: mocks.repo }));
import { OnboardingTour } from './OnboardingTour';
const renderTour = () => render(<NextIntlClientProvider locale="en" messages={{ 'onboarding-tour': messages }}><OnboardingTour repoId="repo" /></NextIntlClientProvider>);
const sections = ['architecture', 'critical_paths', 'local_run', 'reading_path', 'first_tasks'].map((id) => ({ id, items: id === 'local_run' ? [{ kind: 'command', text: 'npm run test', fact_ids: ['script:test'] }] : [], unavailable_reason: null }));
describe('Onboarding Tour', () => {
  it('renders all sections, unknown usage and keeps saved content visible during failure', () => {
    mocks.repo.mockReturnValue({ activeRepo: { name: 'demo' } });
    mocks.mutation.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });
    mocks.query.mockReturnValue({ isLoading: false, data: { tour: { sections, status: 'partial', source_revision: null, freshness: 'unknown', generated_at: '2026-10-29T12:00:00Z', limitations: [], counts: { indexed_files: null, omitted_files: null }, usage: { call_count: 0, input_tokens: null, output_tokens: null, cost_usd: null } }, attempt: { status: 'failed', reason: 'provider_failed', retryable: true, usage: { call_count: 1, cost_usd: null } } } });
    renderTour();
    expect(screen.getAllByRole('button', { name: /architecture overview/i }).length).toBeGreaterThan(0);
    expect(screen.getByText('npm run test')).toBeInTheDocument();
    expect(screen.getAllByText(/unavailable/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /regenerate/i })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /how to run locally/i }));
    expect(screen.queryByText('npm run test')).not.toBeVisible();
    expect(screen.getByRole('button', { name: /how to run locally/i })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: /how to run locally/i }));
    expect(screen.getByText('npm run test')).toBeVisible();
    expect(screen.getByRole('button', { name: /how to run locally/i })).toHaveAttribute('aria-expanded', 'true');
  });
});

beforeEach(() => { mocks.repo.mockReturnValue({ activeRepo: { name: 'demo' } }); mocks.mutation.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false }); });
it('shows empty and pending states and requires explicit generation', () => {
  const mutate = vi.fn(); mocks.mutation.mockReturnValue({ mutate, isPending: false }); mocks.query.mockReturnValue({ isLoading: false, data: { tour: null, attempt: null } });
  renderTour(); expect(screen.getByText(/generate a tour/i)).toBeInTheDocument(); expect(mutate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /generate tour/i })); expect(mutate).toHaveBeenCalledOnce();
});
it('copies the exact displayed command and reports clipboard failure', async () => {
  const clipboard = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('denied'));
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: clipboard } });
  mocks.query.mockReturnValue({ isLoading: false, data: { tour: { sections, status: 'partial', source_revision: null, freshness: 'unknown', generated_at: '2026-10-29T12:00:00Z', limitations: [], counts: { indexed_files: 0, omitted_files: 0 }, usage: { call_count: 0, input_tokens: null, output_tokens: null, cost_usd: 0 } }, attempt: null } });
  renderTour(); const copy = screen.getByRole('button', { name: /copy command: npm run test/i });
  fireEvent.click(copy); await waitFor(() => expect(clipboard).toHaveBeenCalledWith('npm run test')); expect(await screen.findByText('Copied')).toBeInTheDocument();
  fireEvent.click(copy); expect(await screen.findByText('Could not copy')).toBeInTheDocument();
});

it('retains the saved tour while pending, shares its URL and opens a captured file', async () => {
  const clipboard = vi.fn().mockResolvedValue(undefined); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: clipboard } });
  const withPath = sections.map(section => section.id === 'reading_path' ? { ...section, items: [{ kind: 'path', text: 'src/app.ts', fact_ids: ['p'] }] } : section);
  mocks.readFile.mockResolvedValue({ path: 'src/app.ts', revision: 'a'.repeat(40), content: 'file content' });
  mocks.query.mockReturnValue({ isLoading: false, data: { tour: { sections: withPath, status: 'partial', source_revision: 'a'.repeat(40), freshness: 'stale', generated_at: '2026-10-29T12:00:00Z', limitations: ['truncated'], counts: { indexed_files: 10, omitted_files: 2 }, usage: { call_count: 0, input_tokens: null, output_tokens: null, cost_usd: null } }, attempt: { status: 'pending', reason: null, usage: { call_count: 0, input_tokens: null, output_tokens: null, cost_usd: null } } } });
  renderTour(); expect(screen.getByRole('status')).toHaveTextContent('Generating tour');
  expect(screen.getByRole('button', { name: /regenerate/i })).toBeDisabled();
  expect(screen.getByText('src/app.ts')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /share link/i })); await waitFor(() => expect(clipboard).toHaveBeenCalledWith(window.location.href));
  fireEvent.click(screen.getByRole('button', { name: /open file/i }));
  expect(await screen.findByText('file content')).toBeVisible();
  expect(mocks.readFile).toHaveBeenCalledWith('repo', 'src/app.ts', 'a'.repeat(40));
  fireEvent.click(screen.getByRole('button', { name: /close file/i })); expect(screen.queryByText('file content')).not.toBeInTheDocument();
});

it('renders the empty state and distinct populated section layouts', () => {
  mocks.query.mockReturnValue({ isLoading: false, data: { tour: null, attempt: null } });
  const view = renderTour();
  expect(screen.getByRole('button', { name: /generate tour/i })).toBeInTheDocument();
  view.unmount();
  const populated = [
    { id: 'architecture', items: [{ kind: 'dependency', text: 'src/app.ts -> src/db.ts', fact_ids: ['edge'] }], unavailable_reason: null },
    { id: 'critical_paths', items: [{ kind: 'dependency', text: 'src/app.ts -> src/db.ts', fact_ids: ['edge'] }], unavailable_reason: null },
    { id: 'local_run', items: [{ kind: 'command', text: 'npm run test', fact_ids: ['c'] }, { kind: 'command', text: 'npm run dev', fact_ids: ['d'] }], unavailable_reason: null },
    { id: 'reading_path', items: [{ kind: 'path', text: 'src/app.ts', fact_ids: ['p'] }, { kind: 'path', text: 'src/db.ts', fact_ids: ['q'] }], unavailable_reason: null },
    { id: 'first_tasks', items: [{ kind: 'suggestion', text: 'Suggestion: explore src/app.ts', fact_ids: ['p'] }], unavailable_reason: null },
  ];
  mocks.query.mockReturnValue({ isLoading: false, data: { tour: { sections: populated, status: 'partial', source_revision: 'a'.repeat(40), freshness: 'current', generated_at: '2026-10-29T12:00:00Z', limitations: [], counts: { indexed_files: 2, omitted_files: 0 }, usage: { call_count: 1, input_tokens: 1, output_tokens: 2, cost_usd: 0 } }, attempt: null } });
  renderTour();
  expect(screen.getByRole('img', { name: /architecture dependencies/i })).toBeInTheDocument();
  expect(screen.getByRole('list', { name: /local commands/i }).children).toHaveLength(2);
  expect(screen.getByRole('list', { name: /reading path/i }).children).toHaveLength(2);
  expect(screen.getByText('Suggestion: explore src/app.ts')).toBeVisible();
});

it('shows a safe failure reason and retry for a partial first result', () => {
  mocks.query.mockReturnValue({ isLoading: false, data: { tour: { sections, status: 'partial', source_revision: null, freshness: 'unknown', generated_at: '2026-10-29T12:00:00Z', limitations: [], counts: { indexed_files: 0, omitted_files: 0 }, usage: { call_count: 1, input_tokens: null, output_tokens: null, cost_usd: null } }, attempt: { status: 'partial', reason: 'provider_failed', retryable: true, usage: { call_count: 1, input_tokens: null, output_tokens: null, cost_usd: null } } } });
  renderTour();
  expect(screen.getByRole('alert')).toHaveTextContent('The model request failed.');
  expect(screen.getByRole('button', { name: /regenerate/i })).toBeEnabled();
});

it('renders narrative as text, preserving connected sentences without interpreting markup', () => {
  mocks.repo.mockReturnValue({ activeRepo: { name: 'demo' } });
  mocks.mutation.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });
  const withNarrative = sections.map(section => section.id === 'architecture' ? { ...section, narrative: [{ text: 'The repository uses Go.', fact_ids: ['s'] }, { text: 'Read <code> as text.', fact_ids: ['p'] }] } : section);
  mocks.query.mockReturnValue({ isLoading: false, data: { tour: { sections: withNarrative, status: 'generated', source_revision: null, freshness: 'unknown', generated_at: '2026-10-29T12:00:00Z', limitations: [], counts: { indexed_files: 1, omitted_files: 0 }, usage: { call_count: 1, input_tokens: 1, output_tokens: 1, cost_usd: 0 } }, attempt: null } });
  renderTour();
  const paragraph = screen.getByText('The repository uses Go. Read <code> as text.');
  expect(paragraph.querySelector('code')).toBeNull();
});

it('renders one directed diagram and exposes every connection as text', async () => {
  const edges = Array.from({ length: 8 }, (_, i) => ({ kind: 'dependency', text: `src/a${i}.ts -> src/b${i}.ts`, fact_ids: [`edge:${i}`] }));
  const withEdges = sections.map(section => section.id === 'architecture' ? { ...section, items: edges } : section);
  mocks.query.mockReturnValue({ isLoading: false, data: { tour: { sections: withEdges, status: 'partial', source_revision: null, freshness: 'current', generated_at: '2026-10-29T12:00:00Z', limitations: [], counts: { indexed_files: 8, omitted_files: 0 }, usage: { call_count: 1, input_tokens: null, output_tokens: null, cost_usd: null } }, attempt: null } });
  renderTour();
  expect(screen.getAllByRole('img', { name: /architecture dependencies/i })).toHaveLength(1);
  expect(screen.getByRole('img', { name: /architecture dependencies/i }).tagName.toLowerCase()).toBe('svg');
  expect(screen.getByText('Show all 8 dependencies')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Show all 8 dependencies'));
  expect(screen.getAllByRole('img', { name: /architecture dependencies/i })).toHaveLength(1);
  expect(screen.getByText('src/a7.ts -> src/b7.ts')).toBeVisible();
});

it('shows a short reading path first and lets the user reveal the remaining ranked files', () => {
  const items = Array.from({ length: 12 }, (_, i) => ({ kind: 'path', text: `src/file${i}.ts`, fact_ids: [`p${i}`] }));
  const withPaths = sections.map(section => section.id === 'reading_path' ? { ...section, items } : section);
  mocks.query.mockReturnValue({ isLoading: false, data: { tour: { sections: withPaths, status: 'partial', source_revision: null, freshness: 'current', generated_at: '2026-10-29T12:00:00Z', limitations: [], counts: { indexed_files: 12, omitted_files: 0 }, usage: { call_count: 1, input_tokens: null, output_tokens: null, cost_usd: null } }, attempt: null } });
  renderTour();
  expect(screen.getByRole('list', { name: /reading path/i }).children).toHaveLength(5);
  fireEvent.click(screen.getByRole('button', { name: /show all 12 files/i }));
  expect(screen.getByRole('list', { name: /reading path/i }).children).toHaveLength(12);
});
