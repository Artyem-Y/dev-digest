import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../../../messages/en/shell.json';
import { FileCard } from './FileCard';

describe('FileCard findings', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('renders a finding outside the visible patch at the end of its file', () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ shell: messages }}>
        <FileCard
          file={{ path: 'src/example.ts', additions: 1, deletions: 1, patch: '@@ -1 +1 @@\n-old\n+new' }}
          findings={[{ id: 'outside-patch', file: 'src/example.ts', start_line: 99, title: 'Unmapped finding' }] as never}
          renderFinding={(finding) => <div>{finding.title}</div>}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Findings outside this patch')).toBeInTheDocument();
    expect(screen.getByText('Unmapped finding')).toBeInTheDocument();
  });

  it('starts a large file collapsed until a group command expands it', () => {
    const file = {
      path: 'src/large.ts',
      additions: 201,
      deletions: 0,
      patch: '@@ -1 +1 @@\n+large-file-line',
    };
    const { rerender } = render(
      <NextIntlClientProvider locale="en" messages={{ shell: messages }}>
        <FileCard file={file} />
      </NextIntlClientProvider>,
    );

    expect(screen.queryByText('large-file-line')).not.toBeInTheDocument();

    rerender(
      <NextIntlClientProvider locale="en" messages={{ shell: messages }}>
        <FileCard file={file} allFilesOpen />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('large-file-line')).toBeInTheDocument();
  });

  it('keeps a revealed Brief file open after its temporary line marker expires', () => {
    const file = { path: 'src/target.ts', additions: 201, deletions: 0, patch: '@@ -4 +4 @@\n+focused line' };
    const { rerender } = render(
      <NextIntlClientProvider locale="en" messages={{ shell: messages }}>
        <FileCard file={file} focusLine={4} reveal />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('focused line')).toBeInTheDocument();
    expect(document.querySelector('[data-diff-line="4"]')).toBeInTheDocument();
    expect(document.querySelector('[data-brief-focused="true"]')).toHaveAttribute('data-diff-line', '4');
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledOnce();

    rerender(
      <NextIntlClientProvider locale="en" messages={{ shell: messages }}>
        <FileCard file={file} reveal />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('focused line')).toBeInTheDocument();
    expect(document.querySelector('[data-diff-line="4"]')).toBeInTheDocument();
    expect(document.querySelector('[data-brief-focused="true"]')).not.toBeInTheDocument();
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledOnce();
  });

  it('reveals a target file even when the requested line is outside the rendered patch', () => {
    const file = { path: 'src/target.ts', additions: 201, deletions: 0, patch: '@@ -4 +4 @@\n+visible fallback line' };
    render(
      <NextIntlClientProvider locale="en" messages={{ shell: messages }}>
        <FileCard file={file} focusLine={99} reveal />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('visible fallback line')).toBeInTheDocument();
    expect(document.querySelector('[data-diff-line="99"]')).not.toBeInTheDocument();
  });
});
