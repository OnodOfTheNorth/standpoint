/** A minimal observable value with a Preact hook, to avoid a state-management dependency. */
import { useEffect, useState } from 'preact/hooks';

export interface Signal<T> {
  value: T;
  subscribe(fn: () => void): () => void;
}

export function signal<T>(initial: T): Signal<T> {
  let v = initial;
  const subs = new Set<() => void>();
  return {
    get value() {
      return v;
    },
    set value(x: T) {
      v = x;
      for (const f of subs) f();
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export function useSignal<T>(s: Signal<T>): T {
  const [, set] = useState(0);
  useEffect(() => s.subscribe(() => set((n) => n + 1)), [s]);
  return s.value;
}

/** Hash router: returns [path, params]. Routes look like #/journey or #/explore/position/state.nature.x */
export function useHash(): [string, URLSearchParams] {
  const [h, setH] = useState(typeof location !== 'undefined' ? location.hash : '');
  useEffect(() => {
    const on = () => setH(location.hash);
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  const raw = h.replace(/^#/, '') || '/';
  const [path, query] = raw.split('?');
  return [path || '/', new URLSearchParams(query ?? '')];
}

export function go(path: string) {
  location.hash = path;
}
