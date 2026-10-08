import { inflateRawSync } from 'node:zlib';
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import { ValidationError } from '../../platform/errors.js';

const MAX_BODY = 512_000;

function nameFor(markdown: string, fallback: string) {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return (heading || fallback).slice(0, 120);
}

function assertPublicAddress(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === '::1' || normalized.startsWith('::ffff:') || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')) throw new ValidationError('Import URL resolves to a private address');
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0 || a === 169 && b === 254 || a === 172 && b! >= 16 && b! <= 31 || a === 192 && b === 168) throw new ValidationError('Import URL resolves to a private address');
  }
}

async function assertPublicUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new ValidationError('Import URL is invalid'); }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) throw new ValidationError('Only public HTTPS URLs may be imported');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname)) {
    assertPublicAddress(hostname);
    return url;
  }
  const addresses = await lookup(hostname, { all: true });
  if (!addresses.length) throw new ValidationError('Import URL did not resolve');
  addresses.forEach(({ address }) => assertPublicAddress(address));
  return url;
}

export async function markdownFromUrl(value: string) {
  let url = await assertPublicUrl(value);
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(5_000), headers: { accept: 'text/markdown,text/plain;q=0.9' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new ValidationError('Import URL redirect has no location');
      url = await assertPublicUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new ValidationError(`Import URL returned ${response.status}`);
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > MAX_BODY) throw new ValidationError('Imported document is too large');
    const markdown = await response.text();
    if (!markdown.trim() || Buffer.byteLength(markdown) > MAX_BODY) throw new ValidationError('Imported document is empty or too large');
    return markdown;
  }
  throw new ValidationError('Import URL redirected too many times');
}

/** Extract the first safe Markdown entry from a conventional zip central directory. */
export function markdownFromZip(base64: string) {
  const zip = Buffer.from(base64, 'base64');
  if (zip.length === 0 || zip.length > 1_000_000) throw new ValidationError('ZIP archive is empty or too large');
  const signature = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (signature < 0) throw new ValidationError('Invalid ZIP archive');
  const centralOffset = zip.readUInt32LE(signature + 16);
  if (zip.readUInt32LE(centralOffset) !== 0x02014b50) throw new ValidationError('Invalid ZIP directory');
  const nameLength = zip.readUInt16LE(centralOffset + 28);
  const extraLength = zip.readUInt16LE(centralOffset + 30);
  const compressed = zip.readUInt32LE(centralOffset + 20);
  const uncompressed = zip.readUInt32LE(centralOffset + 24);
  const method = zip.readUInt16LE(centralOffset + 10);
  const localOffset = zip.readUInt32LE(centralOffset + 42);
  const filename = zip.subarray(centralOffset + 46, centralOffset + 46 + nameLength).toString('utf8');
  if (!filename.toLowerCase().endsWith('.md') || filename.includes('..') || filename.startsWith('/')) throw new ValidationError('ZIP must contain a safe Markdown file first');
  if (uncompressed > MAX_BODY || zip.readUInt32LE(localOffset) !== 0x04034b50) throw new ValidationError('ZIP Markdown entry is invalid or too large');
  const localName = zip.readUInt16LE(localOffset + 26);
  const localExtra = zip.readUInt16LE(localOffset + 28);
  const payload = zip.subarray(localOffset + 30 + localName + localExtra, localOffset + 30 + localName + localExtra + compressed);
  const output = method === 0 ? payload : method === 8 ? inflateRawSync(payload) : (() => { throw new ValidationError('ZIP compression is unsupported'); })();
  if (output.length > MAX_BODY) throw new ValidationError('ZIP Markdown entry is too large');
  const markdown = output.toString('utf8');
  if (!markdown.trim()) throw new ValidationError('ZIP Markdown entry is empty');
  return markdown;
}

export function previewMarkdown(markdown: string, source: 'manual' | 'imported_url' | 'community') {
  if (!markdown.trim() || Buffer.byteLength(markdown) > MAX_BODY) throw new ValidationError('Markdown is empty or too large');
  return { name: nameFor(markdown, 'Imported skill'), description: 'Imported review skill', type: 'custom' as const, body: markdown, source };
}
