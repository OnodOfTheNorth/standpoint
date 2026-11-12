/** Share links: the session travels in the URL fragment. Situation is stripped unless asked. */
import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';
import type { Session } from './types.js';

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  const b64 = typeof btoa === 'function' ? btoa(s) : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

export function stripSituation(session: Session): Session {
  return {
    ...session,
    log: session.log.filter((e) => e.t !== 'situation' && !(e.t === 'note' && e.key.startsWith('private:'))),
  };
}

export function encodeSession(session: Session, opts: { includeSituation?: boolean } = {}): string {
  const s = opts.includeSituation ? session : stripSituation(session);
  // drop timestamps for compactness
  const compact = { ...s, log: s.log.map(({ at: _at, ...rest }) => rest) };
  return 'v1.' + b64url(deflateSync(strToU8(JSON.stringify(compact)), { level: 9 }));
}

export function decodeSession(token: string): Session {
  const t = token.replace(/^#?(r=)?/, '');
  if (!t.startsWith('v1.')) throw new Error('Unrecognized share token');
  const json = strFromU8(inflateSync(fromB64url(t.slice(3))));
  const s = JSON.parse(json) as Session;
  if (s.format !== 'standpoint.session') throw new Error('Share token does not contain a Standpoint session');
  return s;
}
