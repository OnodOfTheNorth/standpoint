import { useState } from 'preact/hooks';
import { search } from '@standpoint/core';
import { DOMAINS } from '@standpoint/content/schema';
import type { Source } from '@standpoint/content/schema';
import { bundle } from '../store.js';
import { t } from '../i18n/en.js';

const base = () => import.meta.env.BASE_URL;
const cite = (s: Source) => `${s.author}, ${s.title} (${s.year})`;

export function Explore({ path }: { path: string; params: URLSearchParams }) {
  const parts = path.split('/').filter(Boolean); // explore, kind, id
  const kind = parts[1];
  const id = parts.slice(2).join('/');
  if (kind && id) return <Detail kind={kind} id={decodeURIComponent(id)} />;
  return <Index />;
}

function Index() {
  const b = bundle.value!;
  const [q, setQ] = useState('');
  const hits = q.trim().length > 1 ? search(b, q, 40) : [];
  return (
    <section class="explore">
      <h1>{t('explore.title')}</h1>
      <p>{t('explore.intro')}</p>
      <p class="row wrap">
        <a class="btn" href={`${base()}ns/ontology.ttl`} download>
          Turtle
        </a>
        <a class="btn" href={`${base()}ns/ontology.jsonld`} download>
          JSON-LD
        </a>
        <a class="btn" href={`${base()}ns/context.jsonld`} download>
          JSON-LD context
        </a>
        <a class="btn" href={`${base()}data/bundle.json`} download>
          Compiled bundle (JSON)
        </a>
      </p>
      <label class="block">
        {t('explore.search')}
        <input type="search" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      </label>
      {hits.length > 0 && (
        <ul class="hits">
          {hits.map((h) => (
            <li key={h.kind + h.id}>
              <span class="tag">{h.kind}</span> <a href={`#/explore/${h.kind}/${h.id}`}>{h.label}</a>
            </li>
          ))}
        </ul>
      )}
      <div class="two-col">
        <div>
          <h2>Questions, by region</h2>
          {DOMAINS.map((d) => (
            <details key={d}>
              <summary>{d}</summary>
              <ul>
                {Object.values(b.problematics)
                  .filter((p) => p.domain === d)
                  .map((p) => (
                    <li key={p.id}>
                      <a href={`#/explore/problematic/${p.id}`}>{p.question}</a> <span class="muted">({p.positions.length})</span>
                    </li>
                  ))}
              </ul>
            </details>
          ))}
        </div>
        <div>
          <h2>Traditions, by family</h2>
          {Object.values(b.families).map((f) => (
            <details key={f.id}>
              <summary>{f.name}</summary>
              <ul>
                {Object.values(b.traditions)
                  .filter((x) => x.family === f.id)
                  .map((x) => (
                    <li key={x.id}>
                      <a href={`#/explore/tradition/${x.id}`}>{x.name}</a>
                    </li>
                  ))}
              </ul>
            </details>
          ))}
          <h2>Debates</h2>
          <ul>
            {Object.values(b.debates).map((d) => (
              <li key={d.id}>
                <a href={`#/explore/debate/${d.id}`}>{d.name}</a>
              </li>
            ))}
          </ul>
          <h2>Events</h2>
          <ul>
            {Object.values(b.events).map((e) => (
              <li key={e.id}>
                <a href={`#/explore/event/${e.id}`}>
                  {e.name} ({String(e.date)})
                </a>
              </li>
            ))}
          </ul>
          <h2>Thinkers</h2>
          <ul class="inline-list">
            {Object.values(b.thinkers).map((x) => (
              <li key={x.id}>
                <a href={`#/explore/thinker/${x.id}`}>{x.name}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function TLink({ id }: { id: string }) {
  const b = bundle.value!;
  return <a href={`#/explore/tradition/${id}`}>{b.traditions[id]?.name ?? id}</a>;
}
function PLink({ id }: { id: string }) {
  const b = bundle.value!;
  return <a href={`#/explore/position/${id}`}>{b.positions[id]?.label ?? id}</a>;
}
function list<T>(xs: T[], f: (x: T) => preact.ComponentChildren) {
  return xs.map((x, i) => (
    <span key={i}>
      {i > 0 && ', '}
      {f(x)}
    </span>
  ));
}

function Detail({ kind, id }: { kind: string; id: string }) {
  const b = bundle.value!;
  const back = (
    <p>
      <a href="#/explore">← The map of positions</a>
    </p>
  );
  if (kind === 'position' && b.positions[id]) {
    const p = b.positions[id]!;
    const pr = b.problematics[p.problematic]!;
    const thinkers = Object.values(b.thinkers).filter((t) => t.argues.some((a) => a.position === id));
    return (
      <article class="narrow prose detail">
        {back}
        <p class="eyebrow">
          <a href={`#/explore/problematic/${pr.id}`}>{pr.question}</a>
        </p>
        <h1>{p.label}</h1>
        <p class="lede">{p.claim}</p>
        <blockquote>{p.voiced}</blockquote>
        <h2>Its best argument</h2>
        <p>{p.because}</p>
        <h2>The strongest objections</h2>
        {p.against.map((a) => (
          <p key={a.from}>
            <strong>
              <TLink id={a.from} />:
            </strong>{' '}
            {a.text}
          </p>
        ))}
        <h2>Sources</h2>
        <ul>
          {p.sources.map((s) => (
            <li key={s.title}>{cite(s)}</li>
          ))}
        </ul>
        {thinkers.length > 0 && <p>Argued by: {list(thinkers, (x) => <a href={`#/explore/thinker/${x.id}`}>{x.name}</a>)}</p>}
        <h2>Who holds it</h2>
        {(['defining', 'typical', 'contested', 'rejects'] as const).map((k) =>
          (p.traditions[k] ?? []).length ? (
            <p key={k}>
              <strong>{k === 'contested' ? 'contested within' : k}:</strong> {list(p.traditions[k]!, (x) => <TLink id={x} />)}
            </p>
          ) : null,
        )}
        {(p.presupposes.length > 0 || p.excludes.length > 0 || p.tension.length > 0) && (
          <>
            <h2>Relations</h2>
            {p.presupposes.length > 0 && <p>Presupposes: {list(p.presupposes, (x) => <PLink id={x} />)}</p>}
            {p.excludes.length > 0 && <p>Excludes: {list(p.excludes, (x) => <PLink id={x} />)}</p>}
            {p.tension.length > 0 && <p>In tension with: {list(p.tension, (x) => <PLink id={x} />)}</p>}
          </>
        )}
        <section class="analysis">
          <h2>The instrument’s reading</h2>
          <p>
            <strong>Gains if it prevails:</strong> {p.analysis.gains.join(', ') || '—'}. <strong>Pays:</strong> {p.analysis.pays.join(', ') || '—'}.
          </p>
          <p>{p.analysis.mechanism}</p>
          <p>
            Effect on the drain from periphery to core: <strong>{p.analysis.drain}</strong>. Effect on commodification: <strong>{p.analysis.law_of_value}</strong>.
          </p>
          {p.analysis.disputed && <p class="muted">Disputed among materialists: {p.analysis.disputed}</p>}
        </section>
        <p class="small">
          <a href={`https://github.com/OnodOfTheNorth/standpoint/issues/new?template=dispute-an-entry.yml&title=${encodeURIComponent('Dispute: ' + id)}`}>Dispute this entry</a>
        </p>
      </article>
    );
  }
  if (kind === 'problematic' && b.problematics[id]) {
    const pr = b.problematics[id]!;
    return (
      <article class="narrow prose detail">
        {back}
        <p class="eyebrow">
          {pr.domain} · {pr.layer}
        </p>
        <h1>{pr.question}</h1>
        <p class="lede">{pr.plain}</p>
        <ol>
          {pr.positions.map((x) => (
            <li key={x}>
              <PLink id={x} /> — {b.positions[x]!.claim}
            </li>
          ))}
        </ol>
      </article>
    );
  }
  if (kind === 'tradition' && b.traditions[id]) {
    const tr = b.traditions[id]!;
    const defining = Object.values(b.positions).filter((p) => p.traditions.defining?.includes(id));
    return (
      <article class="narrow prose detail">
        {back}
        <p class="eyebrow">
          {b.families[tr.family]?.name} · {tr.era[0]}–{tr.era[1] ?? ''}
          {tr.parent ? (
            <>
              {' '}
              · within <TLink id={tr.parent} />
            </>
          ) : null}
        </p>
        <h1>{tr.name}</h1>
        <h2>In its own words</h2>
        <blockquote>{tr.self}</blockquote>
        {tr.record.length > 0 && (
          <>
            <h2>Record</h2>
            <ul>
              {tr.record.map((r, i) => (
                <li key={i}>
                  {r.date ? <strong>{String(r.date)}: </strong> : null}
                  {r.text}
                  {r.disputed ? <span class="tag">disputed</span> : null}
                </li>
              ))}
            </ul>
          </>
        )}
        {(tr.descendsFrom.length > 0 || tr.breaksWith.length > 0) && (
          <>
            <h2>Lineage</h2>
            {tr.descendsFrom.map((l) => (
              <p key={'d' + l.id}>
                Descends from <TLink id={l.id} />
                {l.event ? ` — ${l.event}` : ''}
                {l.date ? ` (${l.date})` : ''}
              </p>
            ))}
            {tr.breaksWith.map((l) => (
              <p key={'b' + l.id}>
                Breaks with <TLink id={l.id} />
                {l.event ? ` — ${l.event}` : ''}
                {l.date ? ` (${l.date})` : ''}
              </p>
            ))}
          </>
        )}
        {defining.length > 0 && (
          <>
            <h2>Defining positions</h2>
            <ul>
              {defining.map((p) => (
                <li key={p.id}>
                  <PLink id={p.id} />
                </li>
              ))}
            </ul>
          </>
        )}
        {tr.thinkers.length > 0 && <p>Thinkers: {list(tr.thinkers, (x) => <a href={`#/explore/thinker/${x}`}>{b.thinkers[x]?.name ?? x}</a>)}</p>}
        {tr.keyTexts.length > 0 && (
          <>
            <h2>Key texts</h2>
            <ul>
              {tr.keyTexts.map((s) => (
                <li key={s.title}>{cite(s)}</li>
              ))}
            </ul>
          </>
        )}
        <section class="analysis">
          <h2>The instrument’s reading</h2>
          <p>
            <strong>Conditions it arose from.</strong> {tr.analysis.conditions}
          </p>
          <p>
            <strong>Class base.</strong> {tr.analysis.class_base}
          </p>
          <p>
            <strong>Function today.</strong> {tr.analysis.function}
          </p>
          {tr.analysis.disputed && <p class="muted">Disputed: {tr.analysis.disputed}</p>}
        </section>
        <p class="small">
          <a href={`https://github.com/OnodOfTheNorth/standpoint/issues/new?template=dispute-an-entry.yml&title=${encodeURIComponent('Dispute: ' + id)}`}>Dispute this entry</a>
        </p>
      </article>
    );
  }
  if (kind === 'thinker' && b.thinkers[id]) {
    const th = b.thinkers[id]!;
    return (
      <article class="narrow prose detail">
        {back}
        <h1>{th.name}</h1>
        <p class="eyebrow">
          {th.born ?? ''}
          {th.died ? `–${th.died}` : ''} · {th.region} · {list(th.traditions, (x) => <TLink id={x} />)}
        </p>
        <p>{th.summary}</p>
        <h2>Argues</h2>
        <ul>
          {th.argues.map((a, i) => (
            <li key={i}>
              <PLink id={a.position} /> — in <cite>{a.in.title}</cite> ({a.in.year})
            </li>
          ))}
        </ul>
      </article>
    );
  }
  if (kind === 'event' && b.events[id]) {
    const e = b.events[id]!;
    return (
      <article class="narrow prose detail">
        {back}
        <h1>{e.name}</h1>
        <p class="eyebrow">
          {String(e.date)}
          {e.end ? `–${e.end}` : ''} · {e.place}
        </p>
        <p>{e.summary}</p>
        {e.disputed && <p class="muted">Disputed: {e.disputed}</p>}
        {e.problematic && (
          <p>
            Readings: <a href={`#/explore/problematic/${e.problematic}`}>{b.problematics[e.problematic]?.question}</a>
          </p>
        )}
        {e.stances.length > 0 && (
          <ul>
            {e.stances.map((s, i) => (
              <li key={i}>
                <TLink id={s.tradition} />: {s.note}
              </li>
            ))}
          </ul>
        )}
      </article>
    );
  }
  if (kind === 'debate' && b.debates[id]) {
    const d = b.debates[id]!;
    return (
      <article class="narrow prose detail">
        {back}
        <h1>{d.name}</h1>
        <p class="eyebrow">{String(d.date)}</p>
        <p>{d.summary}</p>
        {d.sides.map((s) => (
          <section key={s.label}>
            <h2>{s.label}</h2>
            <p>{s.argument}</p>
            {s.thinkers.length > 0 && <p>{list(s.thinkers, (x) => <a href={`#/explore/thinker/${x}`}>{b.thinkers[x]?.name ?? x}</a>)}</p>}
            {s.positions.length > 0 && <p>Positions: {list(s.positions, (x) => <PLink id={x} />)}</p>}
            <ul>
              {s.texts.map((x) => (
                <li key={x.title}>{cite(x)}</li>
              ))}
            </ul>
          </section>
        ))}
        {d.outcome && <p class="muted">{d.outcome}</p>}
      </article>
    );
  }
  return (
    <section class="narrow">
      {back}
      <p>Nothing found for {id}.</p>
    </section>
  );
}
