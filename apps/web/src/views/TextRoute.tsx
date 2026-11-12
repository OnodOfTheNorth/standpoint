/**
 * Text-only journey: every action is a link, so screen readers and browser-driving
 * agents can take the whole journey without scripts that depend on layout.
 *   #/text?start=sketch            start a new session
 *   #/text?a=<option>              answer the current prompt
 *   #/text?aff=decline|none        use an affordance
 *   #/text?aff=reject&premise=<id> / #/text?aff=depends&condition=<id>
 *   #/text?undo=1                  go back
 */
import { useEffect } from 'preact/hooks';
import { engine, start, bump, currentResult, resume, saved } from '../store.js';
import { t } from '../i18n/en.js';

export function TextRoute({ params }: { params: URLSearchParams }) {
  const key = params.toString();
  useEffect(() => {
    let changed = false;
    const m = params.get('start');
    if (m === 'sketch' || m === 'survey' || m === 'excavation') {
      start(m);
      engine.value!.skipSituation();
      changed = true;
    } else if (!engine.value && saved()) resume();
    const e = engine.value;
    if (e) {
      const p = e.next().prompt;
      try {
        if (p && params.get('a')) {
          if (p.multi) e.answer({ node: p.id, options: params.get('a')!.split(','), at: new Date().toISOString() });
          else e.answer({ node: p.id, option: params.get('a')!, at: new Date().toISOString() });
          changed = true;
        } else if (p && params.get('aff')) {
          const aff = params.get('aff') as 'reject' | 'depends' | 'none' | 'decline';
          e.answer({ node: p.id, affordance: aff, premise: params.get('premise') ?? undefined, condition: params.get('condition') ?? undefined, text: params.get('text') ?? undefined, at: new Date().toISOString() });
          changed = true;
        } else if (params.get('undo')) {
          e.undo();
          changed = true;
        }
      } catch {
        /* ignore stale links */
      }
    }
    if (changed) {
      bump();
      history.replaceState(null, '', '#/text');
      dispatchEvent(new HashChangeEvent('hashchange'));
    }
  }, [key]);
  const e = engine.value;
  if (!e)
    return (
      <section class="narrow textroute">
        <h1>{t('text.title')}</h1>
        <p>{t('text.intro')}</p>
        <ul>
          <li>
            <a href="#/text?start=sketch">Start a Sketch (about 12 decisions)</a>
          </li>
          <li>
            <a href="#/text?start=survey">Start a Survey (about 45 decisions)</a>
          </li>
          <li>
            <a href="#/text?start=excavation">Start an Excavation (open-ended)</a>
          </li>
        </ul>
      </section>
    );
  const step = e.next();
  const p = step.prompt;
  if (!p) {
    const r = currentResult()!;
    return (
      <section class="narrow textroute">
        <h1>Result</h1>
        <p>{r.coverage.statement}</p>
        <h2>Part one: the reading</h2>
        {r.reading.map((c) => (
          <div key={c.id} data-claim={c.id}>
            <h3>{c.headline}</h3>
            {c.body.map((x) => (
              <p key={x}>{x}</p>
            ))}
            <ul>
              {c.mechanism.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        ))}
        <h2>Part two: the map</h2>
        {r.portrait.map((x) => (
          <p key={x}>{x}</p>
        ))}
        <p>
          <a href="#/result">Full result view</a> · <a href="#/text?start=survey">Start again</a>
        </p>
      </section>
    );
  }
  return (
    <section class="narrow textroute" data-node={p.id}>
      <p>
        {p.context.decisions} decisions{p.context.target ? ` of about ${p.context.target}` : ''}.{' '}
        {step.notices.map((n) => (
          <span key={n}>{n} </span>
        ))}
      </p>
      <h1>{p.title ?? p.type}</h1>
      <p>{p.text}</p>
      {p.voices?.map((v) => (
        <p key={v.name}>
          {v.name}: “{v.says}”
        </p>
      ))}
      {p.cases && (
        <ol>
          {p.cases.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
      )}
      {p.allocate ? (
        <p>
          This is an allocation. Use the <a href="#/journey">full journey view</a>, or{' '}
          <a href={`#/text?aff=decline`} data-affordance="decline">
            decline
          </a>
          .
        </p>
      ) : (
        <ol>
          {p.options.map((o) => (
            <li key={o.id}>
              <a href={`#/text?a=${encodeURIComponent(o.id)}`} data-node={p.id} data-option={o.id}>
                {o.text}
              </a>
            </li>
          ))}
        </ol>
      )}
      {p.multi && <p>Several apply? Link format: #/text?a=id1,id2</p>}
      <h2>Other answers</h2>
      <ul>
        {p.premises.map((x) => (
          <li key={x.id}>
            <a href={`#/text?aff=reject&premise=${x.id}`} data-affordance="reject">
              Reject the premise: {x.text}
            </a>
          </li>
        ))}
        <li>
          <a href="#/text?aff=reject&premise=other" data-affordance="reject">
            Reject the premise (other)
          </a>
        </li>
        {p.conditions.map((x) => (
          <li key={x.id}>
            <a href={`#/text?aff=depends&condition=${x.id}`} data-affordance="depends">
              It depends: {x.text}
            </a>
          </li>
        ))}
        <li>
          <a href="#/text?aff=none" data-affordance="none">
            None of these
          </a>
        </li>
        <li>
          <a href="#/text?aff=decline" data-affordance="decline">
            Decline
          </a>
        </li>
        <li>
          <a href="#/text?undo=1">Back</a>
        </li>
      </ul>
    </section>
  );
}
