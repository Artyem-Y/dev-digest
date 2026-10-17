import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import type { PublicDocumentFetcher, PublicDocumentResult } from '../application/ports.js';

const MAX_REDIRECTS = 3;
const MAX_BYTES = 512_000;
const MAX_CHARS = 48_000;
const ALLOWED_TYPES = ['text/plain', 'text/markdown', 'text/x-markdown', 'application/markdown'];

type ResolvedAddress = { address: string; family: number };
type Lookup = (hostname: string, options: { all: true; verbatim: true }) => Promise<ResolvedAddress[]>;
type PinnedRequest = { url: URL; address: string; family: number };
type PinnedResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
  tooLarge?: boolean;
};
type Request = (request: PinnedRequest) => Promise<PinnedResponse>;
type Dependencies = { lookup: Lookup; request: Request };

function ipv6Hextets(address: string): number[] | undefined {
  const parts = address.split('::');
  if (parts.length > 2) return undefined;
  const parseSide = (side: string): number[] | undefined => {
    if (!side) return [];
    const values: number[] = [];
    for (const group of side.split(':')) {
      if (group.includes('.')) {
        const octets = group.split('.').map(Number);
        if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return undefined;
        values.push((octets[0]! << 8) + octets[1]!, (octets[2]! << 8) + octets[3]!);
      } else if (/^[0-9a-f]{1,4}$/i.test(group)) {
        values.push(Number.parseInt(group, 16));
      } else return undefined;
    }
    return values;
  };
  const left = parseSide(parts[0] ?? '');
  const right = parseSide(parts[1] ?? '');
  if (!left || !right) return undefined;
  const zeroes = 8 - left.length - right.length;
  if (zeroes < 0 || (parts.length === 1 && zeroes !== 0)) return undefined;
  return [...left, ...Array<number>(zeroes).fill(0), ...right];
}

function hasIpv6Prefix(address: string, ...prefix: number[]): boolean {
  const hextets = ipv6Hextets(address);
  return hextets !== undefined && prefix.every((value, index) => hextets[index] === value);
}

function isBlockedAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a = -1, b = -1, c = -1] = address.split('.').map(Number);
    return a === 0
      || a === 10
      || a === 100 && b >= 64 && b <= 127
      || a === 127
      || a === 169 && b === 254
      || a === 172 && b >= 16 && b <= 31
      || a === 192 && (
        b === 0
        || b === 2
        || b === 31 && c === 196
        || b === 52 && c === 193
        || b === 88 && c === 99
        || b === 168
        || b === 175 && c === 48
      )
      || a === 198 && (b === 18 || b === 19 || b === 51)
      || a === 203 && b === 0 && c === 113
      || a >= 224;
  }
  if (isIP(address) !== 6) return true;
  const ip = address.toLowerCase();
  return hasIpv6Prefix(address, 0, 0, 0, 0, 0, 0xffff)
    || ip === '::'
    || ip === '::1'
    || ip.startsWith('fe8')
    || ip.startsWith('fe9')
    || ip.startsWith('fea')
    || ip.startsWith('feb')
    || ip.startsWith('fec')
    || ip.startsWith('fed')
    || ip.startsWith('fee')
    || ip.startsWith('fef')
    || ip.startsWith('fc')
    || ip.startsWith('fd')
    || ip.startsWith('ff')
    || ip.startsWith('2001:db8:')
    // Translation prefixes can encode loopback or private IPv4 destinations.
    // Pinning them does not make those destinations public.
    || hasIpv6Prefix(address, 0x64, 0xff9b) // NAT64 (well-known + local-use)
    || hasIpv6Prefix(address, 0x2002) // 6to4
    || hasIpv6Prefix(address, 0x2001, 0x0000); // Teredo
}

async function validateUrl(value: string, lookupAddress: Lookup): Promise<(PinnedRequest & { url: URL }) | undefined> {
  let url: URL;
  try { url = new URL(value); } catch { return undefined; }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) return undefined;
  try {
    const addresses = await lookupAddress(url.hostname, { all: true, verbatim: true });
    if (addresses.length === 0 || addresses.some((entry) => isBlockedAddress(entry.address))) return undefined;
    const address = addresses[0];
    if (!address) return undefined;
    return { url, address: address.address, family: address.family };
  } catch { return undefined; }
}

function readHeader(headers: PinnedResponse['headers'], name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function requestPinned({ url, address, family }: PinnedRequest): Promise<PinnedResponse> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (result: PinnedResponse) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    const fail = (error: Error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };
    const request = httpsRequest({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      headers: { accept: ALLOWED_TYPES.join(', ') },
      servername: isIP(url.hostname) ? undefined : url.hostname,
      lookup: (_hostname, _options, callback) => callback(null, address, family),
      signal: AbortSignal.timeout(5_000),
    }, (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) {
          response.destroy();
          finish({ statusCode: response.statusCode ?? 0, headers: response.headers, body: Buffer.alloc(0), tooLarge: true });
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => finish({
        statusCode: response.statusCode ?? 0,
        headers: response.headers,
        body: Buffer.concat(chunks),
      }));
      response.on('error', fail);
    });
    request.on('error', fail);
    request.end();
  });
}

/** SSRF-resistant bounded retrieval for explicitly labelled plan/spec candidates. */
export class SafePublicDocumentFetcher implements PublicDocumentFetcher {
  private readonly dependencies: Dependencies;

  constructor(dependencies: Dependencies = {
    lookup: (hostname, options) => lookup(hostname, options),
    request: requestPinned,
  }) {
    this.dependencies = dependencies;
  }

  async fetchPlanOrSpec(candidate: string): Promise<PublicDocumentResult> {
    let current = await validateUrl(candidate, this.dependencies.lookup);
    if (!current) return { ok: false, reasonCode: 'url_rejected' };
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      let response: PinnedResponse;
      try {
        response = await this.dependencies.request(current);
      } catch { return { ok: false, reasonCode: 'fetch_failed' }; }
      if (response.statusCode >= 300 && response.statusCode < 400) {
        const location = readHeader(response.headers, 'location');
        if (!location || redirect === MAX_REDIRECTS) return { ok: false, reasonCode: 'redirect_rejected' };
        current = await validateUrl(new URL(location, current.url).toString(), this.dependencies.lookup);
        if (!current) return { ok: false, reasonCode: 'redirect_rejected' };
        continue;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) return { ok: false, reasonCode: 'http_error' };
      const type = readHeader(response.headers, 'content-type')?.split(';', 1)[0]?.toLowerCase() ?? '';
      if (!ALLOWED_TYPES.includes(type)) return { ok: false, reasonCode: 'content_type_rejected' };
      const declared = Number(readHeader(response.headers, 'content-length') ?? 0);
      if (declared > MAX_BYTES) return { ok: false, reasonCode: 'document_too_large' };
      if (response.tooLarge) return { ok: false, reasonCode: 'document_too_large' };
      const text = response.body.toString('utf8').slice(0, MAX_CHARS).trim();
      return text ? { ok: true, text } : { ok: false, reasonCode: 'empty_document' };
    }
    return { ok: false, reasonCode: 'redirect_rejected' };
  }
}
