/** App state: the bundle, the live engine, and local persistence. Nothing leaves the browser. */
import { signal } from './signal.js';
import type { Bundle } from '@standpoint/content/schema';
import { Engine, newSession, computeResult, type Mode, type Session, type Result } from '@standpoint/core';

const KEY = 'standpoint.session.v1';
const SNAP = 'standpoint.snapshots.v1';

export const bundle = signal<Bundle | null>(null);
export const engine = signal<Engine | null>(null);
export const tick = signal(0); // bumped after every engine mutation

export async function loadBundle(): Promise<Bundle> {
  if (bundle.value) return bundle.value;
  const res = await fetch(`${import.meta.env.BASE_URL}data/bundle.json`);
  const b = (await res.json()) as Bundle;
  bundle.value = b;
  return b;
}

export function saved(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function persist() {
  const e = engine.value;
  if (!e) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(e.session));
  } catch {
    /* storage unavailable: the session lives in memory only */
  }
}

export function bump() {
  persist();
  tick.value++;
}

export function start(mode: Mode, respondent?: Session['respondent']) {
  const b = bundle.value!;
  engine.value = new Engine(b, newSession(b, { mode, now: new Date().toISOString(), respondent }));
  bump();
}

export function resume(): boolean {
  const s = saved();
  if (!s || !bundle.value) return false;
  try {
    engine.value = new Engine(bundle.value, s);
    tick.value++;
    return true;
  } catch {
    return false;
  }
}

export function discard() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  engine.value = null;
  tick.value++;
}

export function currentResult(): Result | null {
  const e = engine.value;
  const b = bundle.value;
  if (!e || !b) return null;
  return computeResult(b, e.session, { now: new Date().toISOString().slice(0, 10) });
}

export interface Snapshot {
  date: string;
  mode: Mode;
  session: Session;
}

export function snapshots(): Snapshot[] {
  try {
    return JSON.parse(localStorage.getItem(SNAP) ?? '[]') as Snapshot[];
  } catch {
    return [];
  }
}

export function saveSnapshot() {
  const e = engine.value;
  if (!e) return;
  const list = snapshots();
  list.push({ date: new Date().toISOString(), mode: e.state.mode, session: JSON.parse(JSON.stringify(e.session)) });
  try {
    localStorage.setItem(SNAP, JSON.stringify(list.slice(-20)));
  } catch {
    /* ignore */
  }
  tick.value++;
}

export function download(name: string, body: string | Blob, mime = 'application/json') {
  const blob = typeof body === 'string' ? new Blob([body], { type: mime }) : body;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
