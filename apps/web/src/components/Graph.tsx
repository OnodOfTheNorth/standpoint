import { useEffect, useRef, useState } from 'preact/hooks';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY, type SimulationNodeDatum } from 'd3-force';
import { select } from 'd3-selection';
import { zoom } from 'd3-zoom';
import type { Result } from '@standpoint/core';
import { DOMAINS } from '@standpoint/content/schema';
import { bundle } from '../store.js';

type N = Result['graph']['nodes'][number] & SimulationNodeDatum;

const HUE: Record<string, number> = { method: 270, economy: 25, world: 350, nation: 140, state: 210, history: 45, strategy: 0, culture: 300, ecology: 110, commonsense: 190 };

export function Graph({ r }: { r: Result }) {
  const ref = useRef<SVGSVGElement>(null);
  const [sel, setSel] = useState<string | null>(null);
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const W = 900;
    const H = 640;
    const nodes: N[] = r.graph.nodes.map((n) => ({ ...n }));
    const ids = new Set(nodes.map((n) => n.id));
    const links = r.graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target)).map((e) => ({ ...e }));
    const angle = (d: string) => (DOMAINS.indexOf(d as (typeof DOMAINS)[number]) / DOMAINS.length) * Math.PI * 2;
    const sim = forceSimulation(nodes)
      .force('link', forceLink(links).id((d) => (d as N).id).distance(70).strength(0.4))
      .force('charge', forceManyBody().strength(-120))
      .force('center', forceCenter(W / 2, H / 2))
      .force('x', forceX<N>((d) => W / 2 + Math.cos(angle(d.domain)) * 230).strength(0.08))
      .force('y', forceY<N>((d) => H / 2 + Math.sin(angle(d.domain)) * 200).strength(0.08))
      .force('collide', forceCollide<N>((d) => radius(d) + 4))
      .stop();
    for (let i = 0; i < 300; i++) sim.tick();
    const s = select(svg);
    s.selectAll('*').remove();
    const g = s.append('g');
    s.call(zoom<SVGSVGElement, unknown>().scaleExtent([0.4, 4]).on('zoom', (ev) => g.attr('transform', ev.transform)) as never);
    const defs = s.append('defs');
    defs.append('filter').attr('id', 'fog').append('feGaussianBlur').attr('stdDeviation', 3);
    g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('x1', (d) => (d.source as unknown as N).x!)
      .attr('y1', (d) => (d.source as unknown as N).y!)
      .attr('x2', (d) => (d.target as unknown as N).x!)
      .attr('y2', (d) => (d.target as unknown as N).y!)
      .attr('class', (d) => `edge ${d.kind} ${d.live ? 'live' : ''}`);
    const node = g
      .append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .attr('class', (d) => `gnode ${d.fog ? 'fog' : ''}`)
      .attr('tabindex', (d) => (d.fog ? -1 : 0))
      .attr('role', 'button')
      .attr('aria-label', (d) => (d.fog ? `Unresolved: ${d.label}` : `${d.label}, weight ${d.weight.toFixed(2)}`))
      .on('click', (_, d) => !d.fog && setSel(d.id))
      .on('keydown', (ev: KeyboardEvent, d) => {
        if ((ev.key === 'Enter' || ev.key === ' ') && !d.fog) setSel(d.id);
      });
    node
      .append('circle')
      .attr('r', radius)
      .attr('fill', (d) => (d.fog ? 'var(--fog)' : `hsl(${HUE[d.domain] ?? 200} 55% 52%)`))
      .attr('filter', (d) => (d.fog ? 'url(#fog)' : null));
    node
      .filter((d) => !d.fog && (d.keystone > 0.3 || d.weight > 0.5))
      .append('text')
      .attr('dy', (d) => radius(d) + 12)
      .attr('text-anchor', 'middle')
      .text((d) => (d.label.length > 34 ? d.label.slice(0, 33) + '…' : d.label));
    return () => void sim.stop();
  }, [r]);
  const b = bundle.value!;
  const h = sel ? r.holdings.find((x) => x.position === sel) : null;
  return (
    <div class="graph-wrap">
      <p class="muted small">
        Each dot is a commitment you hold, placed by region; bigger dots carry more of the others. Dashed red lines are live contradictions. Blurred grey dots are regions still in fog. Drag to pan, scroll to zoom, select a dot to see why it is there.
      </p>
      <svg ref={ref} viewBox="0 0 900 640" class="graph" role="group" aria-label="Map of your holdings" />
      {h && (
        <aside class="card" aria-live="polite">
          <p class="headline">{h.label}</p>
          <p>{b.positions[h.position]?.you}</p>
          <p class="muted">Weight {h.weight.toFixed(2)} · confidence {h.confidence.toFixed(2)}</p>
          <ul>
            {h.evidence.map((x, i) => (
              <li key={i}>
                {x.label} ({x.w > 0 ? '+' : ''}
                {x.w})
              </li>
            ))}
          </ul>
          <a href={`#/explore/position/${h.position}`}>Open in the map of positions</a>
        </aside>
      )}
      <details>
        <summary>List view</summary>
        <ul>
          {r.graph.nodes
            .filter((n) => !n.fog)
            .map((n) => (
              <li key={n.id}>
                {n.label} ({n.domain}, {n.weight.toFixed(2)})
              </li>
            ))}
        </ul>
        <p>Unresolved: {r.graph.nodes.filter((n) => n.fog).map((n) => n.label).join(', ')}</p>
      </details>
    </div>
  );
  void reduce;
}

function radius(d: { fog: boolean; weight: number; keystone: number }) {
  return d.fog ? 10 : 5 + d.weight * 8 + d.keystone * 10;
}
