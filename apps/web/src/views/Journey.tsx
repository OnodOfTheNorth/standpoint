import { useEffect, useRef, useState } from 'preact/hooks';
import type { Prompt } from '@standpoint/core';
import { holdings } from '@standpoint/core';
import { DOMAINS } from '@standpoint/content/schema';
import { engine, bundle, bump, tick } from '../store.js';
import { useSignal, go } from '../signal.js';
import { t } from '../i18n/en.js';

const DOMAIN_LABEL: Record<string, string> = {
  method: 'Method',
  economy: 'Economy',
  world: 'World',
  nation: 'Nation & land',
  state: 'State & power',
  history: 'History',
  strategy: 'Strategy',
  culture: 'Culture',
  ecology: 'Ecology & tech',
  commonsense: 'Common sense',
};

export function FogMap() {
  const e = useSignal(engine);
  useSignal(tick);
  const b = bundle.value!;
  if (!e) return null;
  const h = holdings(b, e.state);
  return (
    <div class="fogmap" role="img" aria-label="Progress: regions of the map uncovered so far">
      {DOMAINS.map((d) => {
        const ps = Object.values(b.problematics).filter((p) => p.domain === d);
        const res = ps.length ? ps.reduce((a, p) => a + (h.byProblematic[p.id]?.resolution ?? 0), 0) / ps.length : 0;
        return (
          <div class="fogtile" key={d} style={{ '--res': Math.min(1, res * 2.5) } as Record<string, number>} title={`${DOMAIN_LABEL[d]}: ${Math.round(res * 100)}% resolved`}>
            <span>{DOMAIN_LABEL[d]}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Journey() {
  const e = useSignal(engine);
  useSignal(tick);
  const [lastWhy, setLastWhy] = useState<{ id: string; why: string; probes: string[] } | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  if (!e) {
    return (
      <section class="narrow">
        <h1>{t('nav.take')}</h1>
        <p>
          No journey in progress. <a href="#/">Choose a depth</a> to begin.
        </p>
      </section>
    );
  }
  const step = e.next();
  const answered = (id: string) => {
    const x = e.explain(id);
    setLastWhy(x ? { id, why: x.why, probes: x.probes } : null);
    setShowWhy(false);
    bump();
  };
  return (
    <section class="journey">
      <FogMap />
      {step.notices.map((n) => (
        <p class="notice" role="status" key={n}>
          {n}
        </p>
      ))}
      {lastWhy && (
        <details class="lastwhy" open={showWhy} onToggle={(ev) => setShowWhy((ev.target as HTMLDetailsElement).open)}>
          <summary>{t('journey.why')}</summary>
          <p>{lastWhy.why}</p>
          {lastWhy.probes.length > 0 && (
            <ul>
              {lastWhy.probes.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </details>
      )}
      {step.prompt ? (
        <PromptCard key={step.prompt.id} p={step.prompt} onAnswered={answered} />
      ) : (
        <div class="card done">
          <h1>{t('journey.done.title', { mode: e.state.mode })}</h1>
          <p>{t('journey.done.body')}</p>
          <div class="row">
            <a class="btn primary" href="#/result">
              {t('journey.see-result')}
            </a>
            <button
              class="btn"
              onClick={() => {
                e.setMode('excavation');
                bump();
              }}
            >
              {t('journey.keep-going')}
            </button>
          </div>
        </div>
      )}
      <div class="row journey-foot">
        <button
          class="btn ghost"
          disabled={!e.state.answers.length}
          onClick={() => {
            e.undo();
            setLastWhy(null);
            bump();
          }}
        >
          ← {t('journey.undo')}
        </button>
        <a class="btn ghost" href="#/result">
          {t('journey.result')}
        </a>
      </div>
    </section>
  );
}

type Panel = null | 'reject' | 'depends' | 'none';

export function PromptCard({ p, onAnswered }: { p: Prompt; onAnswered: (id: string) => void }) {
  const e = engine.value!;
  const [panel, setPanel] = useState<Panel>(null);
  const [multi, setMulti] = useState<string[]>([]);
  const [alloc, setAlloc] = useState<Record<string, number>>(() => Object.fromEntries((p.allocate?.items ?? []).map((i) => [i.id, 0])));
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [p.id]);
  const now = () => new Date().toISOString();
  const answer = (a: Parameters<typeof e.answer>[0]) => {
    try {
      e.answer(a);
      setError(null);
      onAnswered(p.id);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (panel || p.multi || p.allocate) return;
      const tag = (ev.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const n = Number(ev.key);
      if (n >= 1 && n <= p.options.length) {
        ev.preventDefault();
        answer({ node: p.id, option: p.options[n - 1]!.id, at: now() });
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });
  const left = p.allocate ? p.allocate.budget - Object.values(alloc).reduce((a, z) => a + z, 0) : 0;
  const ctx = p.context;
  const isStart = ctx.arc && bundle.value!.arcs[ctx.arc.id]?.start === p.id;
  return (
    <article class={`card prompt kind-${p.kind} type-${p.type}`} data-node={p.id} aria-labelledby="prompt-title">
      <p class="eyebrow">
        {ctx.arc ? `${t('journey.arc')}: ${ctx.arc.title}` : ctx.descent ? `${t('journey.descent')}: ${ctx.descent.title}` : p.kind === 'challenge' ? t('journey.challenge') : p.role === 'trunk' ? 'Opening' : p.type}
        {ctx.target ? <span class="count"> · {ctx.decisions} / {ctx.target}</span> : <span class="count"> · {ctx.decisions}</span>}
      </p>
      {isStart && ctx.arc && (
        <p class="role">
          {ctx.arc.role} <span class="place">{ctx.arc.place}</span>
        </p>
      )}
      <h1 id="prompt-title" tabIndex={-1} ref={heading}>
        {p.title ?? ''}
      </h1>
      <p class="prompt-text">{p.text}</p>
      {p.voices && (
        <div class="voices">
          {p.voices.map((v) => (
            <blockquote key={v.name}>
              <cite>{v.name}</cite>
              <p>{v.says}</p>
            </blockquote>
          ))}
        </div>
      )}
      {p.cases && (
        <ol class="cases">
          {p.cases.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
      )}
      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}
      {p.allocate ? (
        <form
          class="allocate"
          onSubmit={(ev) => {
            ev.preventDefault();
            answer({ node: p.id, alloc, at: now() });
          }}
        >
          {p.allocate.items.map((it) => (
            <label key={it.id} class="alloc-row">
              <span>{it.text}</span>
              <input
                type="number"
                min={0}
                max={p.allocate!.budget}
                value={alloc[it.id]}
                data-option={it.id}
                onInput={(ev) => setAlloc({ ...alloc, [it.id]: Math.max(0, Number((ev.target as HTMLInputElement).value) || 0) })}
              />
            </label>
          ))}
          <p class="muted" aria-live="polite">
            {t('journey.allocate-left', { n: left })} {p.allocate.unit}
          </p>
          <button class="btn primary" type="submit" disabled={left !== 0}>
            {t('journey.submit')}
          </button>
        </form>
      ) : p.multi ? (
        <fieldset class="options multi">
          <legend class="sr-only">{p.text}</legend>
          {p.options.map((o) => (
            <label key={o.id} class="check">
              <input
                type="checkbox"
                data-node={p.id}
                data-option={o.id}
                checked={multi.includes(o.id)}
                onChange={(ev) => setMulti((ev.target as HTMLInputElement).checked ? [...multi, o.id] : multi.filter((x) => x !== o.id))}
              />
              <span>{o.text}</span>
            </label>
          ))}
          <button class="btn primary" disabled={!multi.length} onClick={() => answer({ node: p.id, options: multi, at: now() })} data-action="submit-multi">
            {t('journey.multi-submit')}
          </button>
        </fieldset>
      ) : (
        <ol class="options" role="list">
          {p.options.map((o, i) => (
            <li key={o.id}>
              <button class="opt" data-node={p.id} data-option={o.id} onClick={() => answer({ node: p.id, option: o.id, at: now() })}>
                <span class="num" aria-hidden="true">
                  {i + 1}
                </span>
                <span>{o.text}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {p.kind !== 'challenge' && (
        <div class="affordances" role="group" aria-label="Other ways to answer">
          <button class={`aff ${panel === 'reject' ? 'on' : ''}`} data-affordance="reject" aria-expanded={panel === 'reject'} onClick={() => setPanel(panel === 'reject' ? null : 'reject')}>
            {t('journey.reject')}
          </button>
          <button class={`aff ${panel === 'depends' ? 'on' : ''}`} data-affordance="depends" aria-expanded={panel === 'depends'} onClick={() => setPanel(panel === 'depends' ? null : 'depends')}>
            {t('journey.depends')}
          </button>
          <button class={`aff ${panel === 'none' ? 'on' : ''}`} data-affordance="none" aria-expanded={panel === 'none'} onClick={() => setPanel(panel === 'none' ? null : 'none')}>
            {t('journey.none')}
          </button>
          <button class="aff" data-affordance="decline" onClick={() => answer({ node: p.id, affordance: 'decline', at: now() })}>
            {t('journey.decline')}
          </button>
        </div>
      )}
      {panel && <AffordancePanel p={p} kind={panel} onCancel={() => setPanel(null)} onSubmit={(a) => answer({ node: p.id, ...a, at: now() })} />}
    </article>
  );
}

function AffordancePanel({ p, kind, onCancel, onSubmit }: { p: Prompt; kind: Exclude<Panel, null>; onCancel: () => void; onSubmit: (a: { affordance: 'reject' | 'depends' | 'none'; premise?: string; condition?: string; text?: string }) => void }) {
  const list = kind === 'reject' ? p.premises : kind === 'depends' ? p.conditions : [];
  const [pick, setPick] = useState<string>(list[0]?.id ?? 'other');
  const [text, setText] = useState('');
  return (
    <form
      class="aff-panel"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (kind === 'reject') onSubmit({ affordance: 'reject', premise: pick, text: text || undefined });
        else if (kind === 'depends') onSubmit({ affordance: 'depends', condition: pick, text: text || undefined });
        else onSubmit({ affordance: 'none', text: text || undefined });
      }}
    >
      {kind !== 'none' && (
        <fieldset>
          <legend>{kind === 'reject' ? t('journey.which-premise') : t('journey.on-what')}</legend>
          {list.map((x) => (
            <label key={x.id} class="radio">
              <input type="radio" name="aff" value={x.id} checked={pick === x.id} onChange={() => setPick(x.id)} /> {x.text}
            </label>
          ))}
          <label class="radio">
            <input type="radio" name="aff" value="other" checked={pick === 'other'} onChange={() => setPick('other')} /> {t('journey.other')}
          </label>
        </fieldset>
      )}
      <label class="block">
        {t('journey.your-words')}
        <textarea rows={2} value={text} onInput={(ev) => setText((ev.target as HTMLTextAreaElement).value)} />
      </label>
      <div class="row">
        <button class="btn primary" type="submit" data-action="submit-affordance">
          {t('journey.submit')}
        </button>
        <button class="btn ghost" type="button" onClick={onCancel}>
          {t('journey.cancel')}
        </button>
      </div>
    </form>
  );
}

export function goJourney() {
  go('/journey');
}
