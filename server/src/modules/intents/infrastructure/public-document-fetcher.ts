import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { PublicDocumentFetcher, PublicDocumentResult } from '../application/ports.js';

const MAX_REDIRECTS = 3;
const MAX_BYTES = 512_000;
const MAX_CHARS = 48_000;
const ALLOWED_TYPES = ['text/plain', 'text/markdown', 'text/x-markdown', 'application/markdown'];

function isBlockedAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a = -1, b = -1] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || a === 169 && b === 254 || a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31 || a >= 224;
  }
  const ip = address.toLowerCase();
  return ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('ff');
}

async function validateUrl(value: string): Promise<URL | undefined> {
  let url: URL;
  try { url = new URL(value); } catch { return undefined; }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) return undefined;
  try {
    const addresses = await lookup(url.hostname, { all: true, verbatim: true });
    if (addresses.length === 0 || addresses.some((entry) => isBlockedAddress(entry.address))) return undefined;
  } catch { return undefined; }
  return url;
}

/** SSRF-resistant bounded retrieval for explicitly labelled plan/spec candidates. */
export class SafePublicDocumentFetcher implements PublicDocumentFetcher {
  async fetchPlanOrSpec(candidate: string): Promise<PublicDocumentResult> {
    let current = await validateUrl(candidate);
    if (!current) return { ok: false, reasonCode: 'url_rejected' };
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      let response: Response;
      try {
        response = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(5_000) });
      } catch { return { ok: false, reasonCode: 'fetch_failed' }; }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || redirect === MAX_REDIRECTS) return { ok: false, reasonCode: 'redirect_rejected' };
        current = await validateUrl(new URL(location, current).toString());
        if (!current) return { ok: false, reasonCode: 'redirect_rejected' };
        continue;
      }
      if (!response.ok) return { ok: false, reasonCode: 'http_error' };
      const type = response.headers.get('content-type')?.split(';', 1)[0]?.toLowerCase() ?? '';
      if (!ALLOWED_TYPES.includes(type)) return { ok: false, reasonCode: 'content_type_rejected' };
      const declared = Number(response.headers.get('content-length') ?? 0);
      if (declared > MAX_BYTES) return { ok: false, reasonCode: 'document_too_large' };
      const reader = response.body?.getReader();
      if (!reader) return { ok: false, reasonCode: 'empty_document' };
      const chunks: Uint8Array[] = []; let size = 0;
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > MAX_BYTES) { await reader.cancel(); return { ok: false, reasonCode: 'document_too_large' }; }
        chunks.push(next.value);
      }
      const text = new TextDecoder().decode(Buffer.concat(chunks)).slice(0, MAX_CHARS).trim();
      return text ? { ok: true, text } : { ok: false, reasonCode: 'empty_document' };
    }
    return { ok: false, reasonCode: 'redirect_rejected' };
  }
}
