import { useState } from 'preact/hooks';
import { compare, computeResult, decodeSession, type Result, type Session } from '@standpoint/core';
import { bundle, currentResult } from '../store.js';
import { t } from '../i18n/en.js';

function parse(text: string): Result | null {
  const b = bundle.value!;
  const s = text.trim();
  try {
    if (s.startsWith('{')) {
      const x = JSON.parse(s) as { format?: string };
      if (x.format === 'standpoint.result') return x as unknown as Result;
      if (x.format === 'standpoint.session') return computeResult(b, x as Session);
      return null;
    }
    const tok = s.includes('s=') ? s.slice(s.indexOf('s=') + 2) : s;
    return computeResult(b, decodeSession(tok));
  } catch {
    return null;
  }
}

function Slot({ label, value, onChange }: { label: string; value: Result | null; onChange: (r: Result | null) => void }) {
  const [err, setErr] = useState(false);
  const mine = currentResult();
  return (
    <fieldset class="card">
      <legend>{label}</legend>
      {mine && (
        <button class="btn" onClick={() => onChange(mine)}>
          Use my current result
        </button>
      )}
      <label class="block">
        A share link, or a result or session JSON
        <textarea
          rows={3}
          onInput={(e) => {
            const r = parse((e.target as HTMLTextAreaElement).value);
            setErr(!r && !!(e.target as HTMLTextAreaElement).value.trim());
            onChange(r);
          }}
        />
      </label>
      <label class="block">
        Or a file
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (!f) return;
            const r = parse(await f.text());
            setErr(!r);
            onChange(r);
          }}
        />
      </label>
      {err && <p role="alert">That could not be read as a Standpoint result.</p>}
      {value && <p class="muted">{value.coverage.statement}</p>}
    </fieldset>
  );
}

export function CompareView(_: { params: URLSearchParams }) {
  const b = bundle.value!;
  const [a, setA] = useState<Result | null>(null);
  const [c, setC] = useState<Result | null>(null);
  const cmp = a && c ? compare(b, a, c) : null;
  const L = (id: string) => b.positions[id]?.label ?? id;
  return (
    <section class="compare">
      <h1>{t('compare.title')}</h1>
      <p>{t('compare.intro')}</p>
      <div class="two-col">
        <Slot label="First" value={a} onChange={setA} />
        <Slot label="Second" value={c} onChange={setC} />
      </div>
      {cmp && (
        <div class="prose">
          <h2>Class interest</h2>
          <p>{cmp.classInterest.text}</p>
          <h2>The primary contradiction</h2>
          <p>{cmp.primary.text}</p>
          <h2>Shared ground ({cmp.shared.length})</h2>
          <ul>
            {cmp.shared.map((p) => (
              <li key={p}>{L(p)}</li>
            ))}
          </ul>
          <h2>Real disagreements ({cmp.real.length})</h2>
          <ul>
            {cmp.real.map((r, i) => (
              <li key={i}>
                {b.problematics[r.problematic]?.question}: “{L(r.a)}” against “{L(r.b)}”{r.keystone ? ' (keystone)' : ''}
              </li>
            ))}
          </ul>
          <h2>Merely verbal disagreements ({cmp.verbal.length})</h2>
          <ul>
            {cmp.verbal.map((r, i) => (
              <li key={i}>
                “{L(r.a)}” and “{L(r.b)}”: {r.why}
              </li>
            ))}
          </ul>
          <h2>Minimum common program</h2>
          <ul>
            {cmp.minimumProgram.length === 0 && <li>None yet.</li>}
            {cmp.minimumProgram.map((p) => (
              <li key={p.position}>{p.claim}</li>
            ))}
          </ul>
          <h2>Points of struggle</h2>
          <ul>
            {cmp.struggle.map((s, i) => (
              <li key={i}>
                {s.question} — “{s.aLabel}” / “{s.bLabel}”
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
