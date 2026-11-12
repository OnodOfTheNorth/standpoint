import { useState } from 'preact/hooks';
import { engine, bundle, bump } from '../store.js';
import { go } from '../signal.js';
import { t } from '../i18n/en.js';

const GROUPS: Record<string, string> = {
  class: 'How you make a living',
  world: 'Where you are in the world',
  group: 'Your people and your place among others',
  life: 'Your life',
  ai: 'Your conditions as an AI system',
};

export function SituationView() {
  const e = engine.value;
  const b = bundle.value!;
  const [ai, setAi] = useState(e?.state.respondent.kind === 'ai');
  if (!e) {
    go('/');
    return null;
  }
  const fields = b.situation.filter((f) => (ai ? f.for !== 'human' || f.group === 'world' : f.for !== 'ai'));
  const val = (id: string) => e.state.situation[id];
  const set = (id: string, v: string | string[] | null) => {
    e.setSituation(id, v);
    bump();
  };
  const groups = [...new Set(fields.map((f) => f.group))];
  return (
    <section class="narrow situation">
      <h1>{t('situation.title')}</h1>
      <p>{t('situation.intro')}</p>
      <label class="check">
        <input
          type="checkbox"
          checked={ai}
          onChange={(ev) => {
            const on = (ev.target as HTMLInputElement).checked;
            setAi(on);
            e.session.respondent = on ? { kind: 'ai' } : { kind: 'human' };
            e.state.respondent = e.session.respondent;
            bump();
          }}
        />
        <span>{t('situation.ai')}</span>
      </label>
      <div class="row">
        <button
          class="btn ghost"
          data-action="skip-situation"
          onClick={() => {
            e.skipSituation();
            bump();
            go('/journey');
          }}
        >
          {t('situation.skip')}
        </button>
      </div>
      {groups.map((g) => (
        <fieldset class="sit-group" key={g}>
          <legend>{GROUPS[g]}</legend>
          {fields
            .filter((f) => f.group === g)
            .map((f) => (
              <div class="sit-field" key={f.id}>
                <p id={`q-${f.id}`} class="q">
                  {f.question}
                </p>
                <div class="chips" role={f.multi ? 'group' : 'radiogroup'} aria-labelledby={`q-${f.id}`}>
                  {f.options.map((o) => {
                    const cur = val(f.id);
                    const on = Array.isArray(cur) ? cur.includes(o.id) : cur === o.id;
                    return (
                      <button
                        key={o.id}
                        class={`chip ${on ? 'on' : ''}`}
                        role={f.multi ? 'checkbox' : 'radio'}
                        aria-checked={on}
                        data-field={f.id}
                        data-value={o.id}
                        onClick={() => {
                          if (f.multi) {
                            const arr = Array.isArray(cur) ? cur : [];
                            set(f.id, on ? arr.filter((x) => x !== o.id) : [...arr, o.id]);
                          } else set(f.id, on ? null : o.id);
                        }}
                      >
                        {o.text}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
        </fieldset>
      ))}
      {ai && (
        <div class="sit-field">
          <label class="block">
            Model
            <input type="text" value={e.session.respondent.model ?? ''} onInput={(ev) => ((e.session.respondent.model = (ev.target as HTMLInputElement).value || undefined), bump())} />
          </label>
          <label class="block">
            Operator
            <input type="text" value={e.session.respondent.operator ?? ''} onInput={(ev) => ((e.session.respondent.operator = (ev.target as HTMLInputElement).value || undefined), bump())} />
          </label>
        </div>
      )}
      <div class="row">
        <button class="btn primary" data-action="continue" onClick={() => go('/journey')}>
          {t('situation.continue')}
        </button>
      </div>
    </section>
  );
}
