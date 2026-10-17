import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../../../messages/en/shell.json';
import { FileCard } from './FileCard';

describe('FileCard findings', () => {
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
});
