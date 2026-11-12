import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import './styles.css';
import { loadBundle, bundle, engine, tick } from './store.js';
import { useSignal, useHash } from './signal.js';
import { t } from './i18n/en.js';
import { Landing } from './views/Landing.js';
import { SituationView } from './views/Situation.js';
import { Journey } from './views/Journey.js';
import { ResultView, SharedResult } from './views/Result.js';
import { Explore } from './views/Explore.js';
import { CompareView } from './views/Compare.js';
import { TextRoute } from './views/TextRoute.js';
import { MethodView } from './views/Method.js';

function App() {
  const b = useSignal(bundle);
  useSignal(engine);
  useSignal(tick);
  const [path, params] = useHash();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    loadBundle().catch((e) => setErr(String(e)));
  }, []);
  useEffect(() => {
    const main = document.getElementById('main');
    if (main && !path.startsWith('/journey') && !path.startsWith('/text')) main.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [path]);
  let view;
  if (err) view = <p role="alert">Could not load the content bundle: {err}</p>;
  else if (!b) view = <p aria-live="polite" class="loading">Loading the map…</p>;
  else if (path === '/' || path === '') view = <Landing />;
  else if (path === '/situation') view = <SituationView />;
  else if (path === '/journey') view = <Journey />;
  else if (path === '/result') view = <ResultView />;
  else if (path === '/r') view = <SharedResult token={params.get('s') ?? ''} />;
  else if (path.startsWith('/explore')) view = <Explore path={path} params={params} />;
  else if (path === '/compare') view = <CompareView params={params} />;
  else if (path === '/text') view = <TextRoute params={params} />;
  else if (path === '/method') view = <MethodView />;
  else view = <Landing />;
  return (
    <>
      <a class="skip" href="#main" onClick={(e) => (e.preventDefault(), document.getElementById('main')?.focus())}>
        Skip to content
      </a>
      <header class="top">
        <a class="brand" href="#/">
          {t('app.name')}
        </a>
        <nav aria-label="Main">
          <a href="#/journey" aria-current={path === '/journey' ? 'page' : undefined}>
            {t('nav.take')}
          </a>
          <a href="#/result" aria-current={path === '/result' ? 'page' : undefined}>
            {t('nav.result')}
          </a>
          <a href="#/explore" aria-current={path.startsWith('/explore') ? 'page' : undefined}>
            {t('nav.explore')}
          </a>
          <a href="#/compare" aria-current={path === '/compare' ? 'page' : undefined}>
            {t('nav.compare')}
          </a>
          <a href="#/method" aria-current={path === '/method' ? 'page' : undefined}>
            {t('nav.method')}
          </a>
          <a href="#/text" aria-current={path === '/text' ? 'page' : undefined}>
            {t('nav.text')}
          </a>
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        {view}
      </main>
      <footer class="foot">
        <p>{t('privacy.short')}</p>
        <p>
          Code AGPL-3.0, content and ontology CC BY-SA 4.0.{' '}
          <a href="https://github.com/OnodOfTheNorth/standpoint">Source</a> ·{' '}
          <a href="https://github.com/OnodOfTheNorth/standpoint/issues/new?template=dispute-an-entry.yml">Dispute an entry</a>
        </p>
      </footer>
    </>
  );
}

render(<App />, document.getElementById('app')!);
