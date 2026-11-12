/** A deterministic glyph and share card, generated from holdings. */
import type { Bundle } from '@standpoint/content/schema';
import { DOMAINS } from '@standpoint/content/schema';
import type { Result } from './result.js';
import { hash32 } from './rng.js';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const LOV_HUE: Record<string, number> = { extends: 28, regulates: 48, none: 210, suspends: 165, abolishes: 190 };

export function glyphSvg(b: Bundle, r: Result, size = 160): string {
  const c = size / 2;
  const R = size * 0.46;
  const n = DOMAINS.length;
  const parts: string[] = [];
  // fog ring per domain
  DOMAINS.forEach((d, i) => {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    const rr = R * (0.25 + 0.75 * (r.coverage.byDomain[d] ?? 0));
    const p = (a: number, rad: number) => `${(c + Math.cos(a) * rad).toFixed(2)},${(c + Math.sin(a) * rad).toFixed(2)}`;
    parts.push(`<path d="M${c},${c} L${p(a0, rr)} A${rr.toFixed(2)},${rr.toFixed(2)} 0 0 1 ${p(a1, rr)} Z" fill="currentColor" fill-opacity="${(0.05 + 0.1 * (i % 2)).toFixed(2)}"/>`);
  });
  // holdings as petals
  for (const h of r.holdings) {
    const p = b.positions[h.position];
    if (!p) continue;
    const d = b.problematics[p.problematic]!.domain;
    const i = DOMAINS.indexOf(d);
    const jitter = (hash32(h.position) % 1000) / 1000;
    const a = ((i + 0.1 + 0.8 * jitter) / n) * Math.PI * 2 - Math.PI / 2;
    const len = R * (0.35 + 0.65 * h.weight);
    const x = c + Math.cos(a) * len;
    const y = c + Math.sin(a) * len;
    const hue = LOV_HUE[p.analysis.law_of_value] ?? 210;
    const ks = r.keystones.some((k) => k.position === h.position);
    parts.push(`<line x1="${c}" y1="${c}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" stroke="hsl(${hue} 55% 50%)" stroke-opacity="0.55" stroke-width="${ks ? 2.2 : 1}"/>`);
    parts.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(1.5 + 3 * h.weight + (ks ? 2 : 0)).toFixed(2)}" fill="hsl(${hue} 60% 50%)"/>`);
  }
  // tensions as chords
  for (const t of r.tensions.live.slice(0, 6)) {
    const pts = t.between
      .map((pid) => r.graph.nodes.find((g) => g.id === pid))
      .filter(Boolean)
      .map((g) => {
        const i = DOMAINS.indexOf(g!.domain as (typeof DOMAINS)[number]);
        const jitter = (hash32(g!.id) % 1000) / 1000;
        const a = ((i + 0.1 + 0.8 * jitter) / n) * Math.PI * 2 - Math.PI / 2;
        const len = R * (0.35 + 0.65 * g!.weight);
        return [c + Math.cos(a) * len, c + Math.sin(a) * len] as const;
      });
    if (pts.length >= 2)
      parts.push(`<path d="M${pts[0]![0].toFixed(2)},${pts[0]![1].toFixed(2)} Q${c},${c} ${pts[1]![0].toFixed(2)},${pts[1]![1].toFixed(2)}" fill="none" stroke="hsl(350 70% 55%)" stroke-width="1.4" stroke-dasharray="3 2"/>`);
  }
  parts.push(`<circle cx="${c}" cy="${c}" r="2.5" fill="currentColor"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Standpoint glyph: a figure generated from this result's holdings">${parts.join('')}</svg>`;
}

/** The three held commitments that most distinguish this person: firm, rare among traditions, important. */
export function distinguishing(b: Bundle, r: Result, k = 3) {
  return r.holdings
    .map((h) => {
      const p = b.positions[h.position]!;
      const affirmers = (p.traditions.defining?.length ?? 0) + (p.traditions.typical?.length ?? 0);
      const imp = b.problematics[p.problematic]!.importance;
      return { position: h.position, label: p.label, you: p.you, score: h.weight * (1 / (1 + affirmers * 0.25)) * imp };
    })
    .sort((a, z) => z.score - a.score || a.position.localeCompare(z.position))
    .slice(0, k);
}

function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > width) {
      if (cur) lines.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

export function cardSvg(b: Bundle, r: Result): string {
  const W = 1200;
  const H = 630;
  const dist = distinguishing(b, r);
  const t = r.tensions.live.find((x) => x.principal) ?? r.tensions.live[0];
  const glyph = glyphSvg(b, r, 360).replace('<svg ', '<svg x="60" y="135" ');
  const lines: string[] = [];
  let y = 150;
  lines.push(`<text x="470" y="${y}" font-size="22" fill="#8a8f98" font-family="system-ui, sans-serif" letter-spacing="2">THREE COMMITMENTS THAT DISTINGUISH THIS RESULT</text>`);
  y += 40;
  for (const d of dist) {
    for (const ln of wrap(d.label, 44)) {
      lines.push(`<text x="470" y="${y}" font-size="32" fill="#f2f2f0" font-family="Georgia, serif">${esc(ln)}</text>`);
      y += 38;
    }
    y += 14;
  }
  if (t) {
    y += 10;
    lines.push(`<text x="470" y="${y}" font-size="22" fill="#e5737f" font-family="system-ui, sans-serif" letter-spacing="2">SHARPEST LIVE CONTRADICTION</text>`);
    y += 36;
    for (const ln of wrap(t.explain, 58).slice(0, 3)) {
      lines.push(`<text x="470" y="${y}" font-size="24" fill="#d8d8d4" font-family="Georgia, serif">${esc(ln)}</text>`);
      y += 30;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="#14161a"/>
<text x="60" y="80" font-size="40" fill="#f2f2f0" font-family="Georgia, serif">Standpoint</text>
<text x="60" y="112" font-size="20" fill="#8a8f98" font-family="system-ui, sans-serif">${esc(r.meta.mode)} · ${esc(String(r.meta.date).slice(0, 10))} · ${Math.round(r.coverage.overall * 100)}% resolved</text>
<g style="color:#f2f2f0">${glyph}</g>
${lines.join('\n')}
</svg>`;
}
