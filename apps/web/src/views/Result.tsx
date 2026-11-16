import { useMemo, useState } from 'preact/hooks';
import type { Result, Claim } from '@standpoint/core';
import { computeResult, decodeSession, encodeSession, glyphSvg, cardSvg, diff } from '@standpoint/core';
import { exportResult, type ExportFormat } from '@standpoint/ontology';
import { engine, bundle, bump, tick, currentResult, download, saveSnapshot, snapshots } from '../store.js';
import { useSignal } from '../signal.js';
import { t, type Key } from '../i18n/en.js';
import { Graph } from '../components/Graph.js';
import { Lineage } from '../components/Lineage.js';

const SECTION_TITLE: Record<Claim['section'], string> = {
  respondent: 'Who answered',
  serves: 'Whom it serves',
  primary: 'The primary contradiction',
  pressure: 'Under pressure',
  crisis: 'When the center fails',
  method: 'Working method',
  motion: 'Motion',
  organization: 'Organization',
  anomalies: 'Anomalies',
};

export function ResultView() {
  useSignal(tick);
  const e = useSignal(engine);
  const r = useMemo(() => currentResult(), [tick.value, e]);
  if (!r)
    return (
      <section class="narrow">
        <h1>{t('result.title')}</h1>
        <p>
          No result yet. <a href="#/">Take the journey</a>, or open a shared link.
        </p>
      </section>
    );
  return <ResultBody r={r} editable />;
}

export function SharedResult({ token }: { token: string }) {
  const b = bundle.value!;
  const r = useMemo(() => {
    try {
      return computeResult(b, decodeSession(token));
    } catch {
      return null;
    }
  }, [token]);
  if (!r) return <p role="alert">This share link could not be read.</p>;
  return (
    <>
      <p class="notice">{t('result.shared-view')}</p>
      <ResultBody r={r} editable={false} />
    </>
  );
}

function ResultBody({ r, editable }: { r: Result; editable: boolean }) {
  const sections = [...new Set(r.reading.map((c) => c.section))];
  return (
    <section class="result">
      <header class="result-head">
        <div class="glyph" aria-hidden="true" dangerouslySetInnerHTML={{ __html: glyphSvg(bundle.value!, r, 120) }} />
        <div>
          <h1>{t('result.title')}</h1>
          <p class="coverage">{r.coverage.statement}</p>
          {editable && (
            <p>
              <a class="btn" href="#/journey">
                {t('journey.keep-going')}
              </a>
            </p>
          )}
        </div>
      </header>
      <h2 class="part">{t('result.part1')}</h2>
      <p class="muted">{t('result.part1.note')}</p>
      {sections.map((s) => (
        <section class="reading-section" key={s} aria-labelledby={`sec-${s}`}>
          <h3 id={`sec-${s}`}>{SECTION_TITLE[s]}</h3>
          {r.reading
            .filter((c) => c.section === s)
            .map((c) => (
              <ClaimCard key={c.id} c={c} editable={editable} />
            ))}
        </section>
      ))}
      <h2 class="part">{t('result.part2')}</h2>
      <p class="muted">{t('result.part2.note')}</p>
      <MapTabs r={r} editable={editable} />
      <Exports r={r} editable={editable} />
    </section>
  );
}

function ClaimCard({ c, editable }: { c: Claim; editable: boolean }) {
  const [open, setOpen] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [text, setText] = useState('');
  return (
    <article class="claim" data-claim={c.id}>
      <p class="headline">{c.headline}</p>
      {c.body.map((x) => (
        <p key={x}>{x}</p>
      ))}
      {c.mechanism.length > 0 && (
        <details>
          <summary>{t('result.mechanism')}</summary>
          <ul>
            {c.mechanism.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </details>
      )}
      {c.disputed && (
        <details>
          <summary>{t('result.disputed-materialists')}</summary>
          <p>{c.disputed}</p>
        </details>
      )}
      {c.evidence.length > 0 && (
        <details open={open} onToggle={(ev) => setOpen((ev.target as HTMLDetailsElement).open)}>
          <summary>{t('result.evidence')}</summary>
          <ul class="evidence">
            {c.evidence.map((x, i) => (
              <li key={i}>
                <span class="tag">{x.kind}</span> {x.kind === 'position' ? <a href={`#/explore/position/${x.id}`}>{x.label}</a> : x.label}
              </li>
            ))}
          </ul>
        </details>
      )}
      {c.dispute && (
        <p class="disputed">
          {t('result.disputed')}: “{c.dispute.text}”
        </p>
      )}
      {editable &&
        (disputing ? (
          <form
            class="dispute"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (!text.trim()) return;
              engine.value!.dispute(c.id, text.trim());
              bump();
              setDisputing(false);
            }}
          >
            <label class="block">
              Why is this wrong?
              <textarea rows={3} value={text} onInput={(ev) => setText((ev.target as HTMLTextAreaElement).value)} />
            </label>
            <button class="btn primary">{t('journey.submit')}</button>
          </form>
        ) : (
          <button class="link" onClick={() => setDisputing(true)}>
            {t('result.dispute')}
          </button>
        ))}
    </article>
  );
}

const TABS = ['portrait', 'map', 'keystones', 'contradictions', 'lineage', 'record', 'neighbors', 'readings', 'practice', 'origins', 'library', 'holdings'] as const;

function MapTabs({ r, editable }: { r: Result; editable: boolean }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('portrait');
  const b = bundle.value!;
  const P = (id: string) => b.positions[id];
  return (
    <div class="tabs">
      <div role="tablist" aria-label="Map views" class="tablist">
        {TABS.map((x) => (
          <button key={x} role="tab" id={`tab-${x}`} aria-selected={tab === x} aria-controls={`panel-${x}`} class={tab === x ? 'on' : ''} onClick={() => setTab(x)}>
            {t(`result.tab.${x}` as Key)}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} class="panel">
        {tab === 'portrait' && (
          <div class="prose">
            {r.portrait.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        )}
        {tab === 'map' && <Graph r={r} />}
        {tab === 'keystones' && (
          <ol class="keystones">
            {r.keystones.length === 0 && <p>Not enough resolved yet.</p>}
            {r.keystones.map((k) => (
              <li key={k.position}>
                <p class="headline">
                  <a href={`#/explore/position/${k.position}`}>{k.label}</a>
                </p>
                <p>{k.you}</p>
                {k.dependents.length > 0 && <p class="muted">Carries: {k.dependents.map((d) => P(d)?.label ?? d).join('; ')}</p>}
                {k.strongestObjection && (
                  <p class="objection">
                    The strongest case against it, from {b.traditions[k.strongestObjection.from]?.name ?? k.strongestObjection.from}: {k.strongestObjection.text}
                  </p>
                )}
                <MoveNote position={k.position} value={k.move} editable={editable} />
              </li>
            ))}
          </ol>
        )}
        {tab === 'contradictions' && (
          <div>
            {r.tensions.live.length === 0 && r.tensions.confronted.length === 0 && <p>No contradictions detected yet.</p>}
            {r.tensions.live.map((x) => (
              <article class="claim" key={x.rule}>
                <p class="headline">
                  {x.principal ? 'Principal: ' : ''}
                  {x.explain}
                </p>
                <p class="muted">
                  {x.type} · {x.between.map((p) => P(p)?.label ?? b.practice[p]?.text ?? p).join(' / ')}
                </p>
              </article>
            ))}
            {r.tensions.confronted.map((x) => (
              <article class="claim" key={x.rule}>
                <p class="headline">Faced: {x.between.map((p) => P(p)?.label ?? p).join(' / ')}</p>
                <p>
                  You answered: “{x.resolutionText}” ({x.kind === 'yield' ? 'one side gave way' : x.kind === 'hold' ? 'held both, with a reason' : x.kind === 'reject' ? 'rejected the framing' : x.kind === 'condition' ? 'made it conditional' : 'declined'})
                  {x.followup ? ` — ${x.followup}` : ''}
                </p>
              </article>
            ))}
            <p class="muted">These are the points where you are in motion.</p>
          </div>
        )}
        {tab === 'lineage' && <Lineage r={r} />}
        {tab === 'record' && (
          <ol class="timeline">
            {r.record.filter((x) => x.stood).length === 0 && <p>No historical verdicts yet. Excavation mode and the history descents ask them.</p>}
            {r.record
              .filter((x) => x.stood)
              .map((x) => (
                <li key={x.event}>
                  <span class="date">{String(x.date)}</span>
                  <div>
                    <p class="headline">{x.name}</p>
                    <p>{x.stood!.you}</p>
                    {x.withWhom.length > 0 && <p class="muted">With: {x.withWhom.map((w) => w.name).join(', ')}</p>}
                  </div>
                </li>
              ))}
          </ol>
        )}
        {tab === 'neighbors' && (
          <ul class="neighbors">
            {r.neighbors.length === 0 && <p>No thinkers near enough yet.</p>}
            {r.neighbors.map((n) => (
              <li key={n.thinker}>
                <p class="headline">
                  <a href={`#/explore/thinker/${n.thinker}`}>{n.name}</a>
                </p>
                <p>
                  With them on: {n.agree.map((a) => `${P(a.position)?.label} (${a.in.title}, ${a.in.year}${a.via ? `, as reported in ${a.via.author}, ${a.via.title}, ${a.via.year}` : ''})`).join('; ')}
                </p>
                {n.part.length > 0 && <p class="muted">You part on: {n.part.map((a) => `${P(a.position)?.label} — you hold “${P(a.yours)?.label}”`).join('; ')}</p>}
              </li>
            ))}
          </ul>
        )}
        {tab === 'readings' && (
          <div class="readings">
            {r.otherReadings.map((o) => (
              <article class="claim" key={o.tradition}>
                <p class="headline">
                  A {o.name} reading{o.nearest ? ' (your nearest tradition)' : o.farthest ? ' (your farthest)' : ''}
                </p>
                {o.text.map((x) => (
                  <p key={x}>{x}</p>
                ))}
              </article>
            ))}
          </div>
        )}
        {tab === 'practice' && (
          <div class="two-col">
            <div>
              <h4>What you hold about change</h4>
              <ul>
                {r.theoryPractice.commitments.map((c) => (
                  <li key={c.position}>{c.label}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4>What you do</h4>
              <ul>
                {r.theoryPractice.practice.length === 0 && <li>Nothing reported.</li>}
                {r.theoryPractice.practice.map((p) => (
                  <li key={p.id}>{p.text}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {tab === 'origins' && (
          <ul>
            {r.origins.map((o) => (
              <li key={o.position}>
                <strong>{o.label}</strong>: {o.originText ? `${o.originText} (${o.kind})` : 'not asked yet'}
              </li>
            ))}
          </ul>
        )}
        {tab === 'library' && (
          <div class="two-col">
            <div>
              <h4>For what you hold</h4>
              <ul class="library">
                {r.library.for.map((s) => (
                  <li key={s.title}>
                    {s.author}, <cite>{s.title}</cite> ({s.year})
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4>The strongest against</h4>
              <ul class="library">
                {r.library.against.map((s) => (
                  <li key={s.title}>
                    {s.author}, <cite>{s.title}</cite> ({s.year}) <span class="muted">— against “{P(s.against)?.label}”</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {tab === 'holdings' && <Holdings r={r} editable={editable} />}
      </div>
    </div>
  );
}

function MoveNote({ position, value, editable }: { position: string; value: string | null; editable: boolean }) {
  const [text, setText] = useState(value ?? '');
  if (!editable) return value ? <p class="muted">What would move them: {value}</p> : null;
  return (
    <label class="block">
      {t('result.move')}
      <textarea
        rows={2}
        value={text}
        onInput={(ev) => setText((ev.target as HTMLTextAreaElement).value)}
        onBlur={() => {
          if (text !== (value ?? '')) {
            engine.value!.note(`move:${position}`, text);
            bump();
          }
        }}
      />
    </label>
  );
}

function Holdings({ r, editable }: { r: Result; editable: boolean }) {
  const b = bundle.value!;
  return (
    <table class="holdings">
      <thead>
        <tr>
          <th scope="col">Question</th>
          <th scope="col">You hold</th>
          <th scope="col">Weight</th>
          <th scope="col">Evidence</th>
          {editable && <th scope="col">Correct</th>}
        </tr>
      </thead>
      <tbody>
        {r.holdings.map((h) => (
          <tr key={h.position}>
            <td>{b.problematics[h.problematic]?.question}</td>
            <td>
              <a href={`#/explore/position/${h.position}`}>{h.label}</a>
              {h.corrected ? <span class="tag">corrected</span> : null}
            </td>
            <td>{h.weight.toFixed(2)}</td>
            <td>
              <details>
                <summary>{h.evidence.length}</summary>
                <ul>
                  {h.evidence.map((x, i) => (
                    <li key={i}>
                      {x.label} ({x.w > 0 ? '+' : ''}
                      {x.w})
                    </li>
                  ))}
                </ul>
              </details>
            </td>
            {editable && (
              <td>
                <button class="link" onClick={() => (engine.value!.correct(h.position, 'reject'), bump())}>
                  {t('result.correct.reject')}
                </button>
                {h.corrected && (
                  <button class="link" onClick={() => (engine.value!.correct(h.position, 'clear'), bump())}>
                    {t('result.correct.clear')}
                  </button>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Exports({ r, editable }: { r: Result; editable: boolean }) {
  const b = bundle.value!;
  const [incSit, setIncSit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [diffWith, setDiffWith] = useState<number | null>(null);
  const e = engine.value;
  const link = e && editable ? `${location.origin}${location.pathname}#/r?s=${encodeSession(e.session, { includeSituation: incSit })}` : location.href;
  const fmts: [ExportFormat, string][] = [
    ['json', 'JSON'],
    ['jsonld', 'JSON-LD'],
    ['ttl', 'Turtle'],
    ['graphml', 'GraphML'],
    ['md', 'profile.md (for AI context)'],
  ];
  const snaps = snapshots();
  const d = diffWith !== null && snaps[diffWith] ? diff(b, computeResult(b, snaps[diffWith]!.session), r) : null;
  const pngCard = async () => {
    const svg = cardSvg(b, r);
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 630;
    c.getContext('2d')!.drawImage(img, 0, 0);
    c.toBlob((blob) => blob && download('standpoint-card.png', blob, 'image/png'));
  };
  return (
    <section class="exports" aria-labelledby="exports-h">
      <h2 id="exports-h">{t('result.export')}</h2>
      <div class="row wrap">
        {fmts.map(([f, label]) => (
          <button key={f} class="btn" data-export={f} onClick={() => {
            const x = exportResult(b, r, f);
            download(`standpoint-result.${x.ext}`, x.body, x.mime);
          }}>
            {label}
          </button>
        ))}
        {e && editable && (
          <button class="btn" data-export="session" onClick={() => download('standpoint-session.json', JSON.stringify(e.session, null, 2))}>
            Session (to resume or replay)
          </button>
        )}
      </div>
      <h2>{t('result.share')}</h2>
      {editable && (
        <>
          <p class="muted">{t('result.share.note')}</p>
          <label class="check">
            <input type="checkbox" checked={incSit} onChange={(ev) => setIncSit((ev.target as HTMLInputElement).checked)} /> <span>{t('result.share.include-situation')}</span>
          </label>
          <div class="row">
            <input class="sharelink" data-action="share-link" readOnly value={link} aria-label="Share link" />
            <button
              class="btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                } catch {
                  /* clipboard unavailable */
                }
              }}
            >
              {copied ? t('result.share.copied') : t('result.share.copy')}
            </button>
          </div>
        </>
      )}
      <div class="row">
        <button class="btn" data-action="card-png" onClick={pngCard}>
          {t('result.card')}
        </button>
      </div>
      {editable && (
        <>
          <h2>{t('result.snapshots')}</h2>
          <div class="row wrap">
            <button class="btn" onClick={() => saveSnapshot()}>
              {t('result.snapshot')}
            </button>
            <a class="btn ghost" href="#/" onClick={() => saveSnapshot()}>
              {t('result.retake')}
            </a>
          </div>
          {snaps.length > 0 && (
            <ul>
              {snaps.map((s, i) => (
                <li key={s.date}>
                  {s.date.slice(0, 16).replace('T', ' ')} ({s.mode}){' '}
                  <button class="link" onClick={() => setDiffWith(i)}>
                    {t('result.diff')}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {d && (
            <div class="card">
              <p class="headline">Since {d.from.slice(0, 10)}</p>
              <p>Now hold: {d.gained.map((x) => x.label).join('; ') || 'nothing new'}</p>
              <p>No longer hold: {d.lost.map((x) => x.label).join('; ') || 'nothing'}</p>
              <p>Moved: {d.moved.map((x) => `${x.label} ${x.from.toFixed(2)}→${x.to.toFixed(2)}`).join('; ') || 'nothing'}</p>
              <p>Contradictions opened: {d.tensionsOpened.length}; closed: {d.tensionsClosed.length}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
