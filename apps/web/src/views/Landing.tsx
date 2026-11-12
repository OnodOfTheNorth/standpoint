import { saved, start, resume, discard, bundle } from '../store.js';
import { go } from '../signal.js';
import { t } from '../i18n/en.js';
import type { Mode } from '@standpoint/core';

export function Landing() {
  const s = saved();
  const b = bundle.value!;
  const begin = (m: Mode) => {
    start(m);
    go('/situation');
  };
  const counts = {
    problematics: Object.keys(b.problematics).length,
    positions: Object.keys(b.positions).length,
    traditions: Object.keys(b.traditions).length,
    nodes: Object.keys(b.nodes).length,
  };
  return (
    <section class="landing">
      <h1 class="hero">{t('app.tagline')}</h1>
      <p class="lede">{t('landing.what')}</p>
      {s && (
        <div class="card resume">
          <h2>{t('landing.resume')}</h2>
          <p>{t('landing.resume.desc', { n: s.log.filter((x) => x.t === 'answer').length, mode: s.mode })}</p>
          <div class="row">
            <button class="btn primary" onClick={() => resume() && go('/journey')}>
              {t('landing.resume')}
            </button>
            <button class="btn ghost" onClick={() => discard()}>
              {t('landing.discard')}
            </button>
          </div>
        </div>
      )}
      <h2>{t('landing.how')}</h2>
      <div class="modes">
        {(['sketch', 'survey', 'excavation'] as const).map((m) => (
          <button key={m} class="mode card" data-mode={m} onClick={() => begin(m)}>
            <strong>{t(`mode.${m}`)}</strong>
            <span>{t(`mode.${m}.desc`)}</span>
          </button>
        ))}
      </div>
      <p class="muted small">
        The map behind it: {counts.problematics} questions, {counts.positions} positions, {counts.traditions} traditions, {counts.nodes} scenes and probes. <a href="#/explore">Explore it.</a>
      </p>
      <p class="muted small">{t('privacy.short')}</p>
      <p class="muted small">
        {t('landing.agents')} <a href="#/text">Text-only route</a>.
      </p>
    </section>
  );
}
