import { describe, expect, it } from 'vitest';
import { markdownFromUrl, markdownFromZip, previewMarkdown } from '../src/modules/skills/import.js';

describe('skill import boundary', () => {
  it('rejects private-network URL imports before performing a request', async () => {
    await expect(markdownFromUrl('https://127.0.0.1/skill.md')).rejects.toThrow('private address');
    await expect(markdownFromUrl('https://[::ffff:127.0.0.1]/skill.md')).rejects.toThrow('private address');
  });

  it('rejects invalid archives and validates Markdown previews', () => {
    expect(() => markdownFromZip(Buffer.from('not a zip').toString('base64'))).toThrow('Invalid ZIP');
    expect(previewMarkdown('# Contract checks\n\nReject breaking responses.', 'community')).toMatchObject({ name: 'Contract checks', type: 'custom' });
  });
});
