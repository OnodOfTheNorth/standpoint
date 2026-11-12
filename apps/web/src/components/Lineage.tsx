import { useState } from 'preact/hooks';
import type { Result } from '@standpoint/core';
import { bundle } from '../store.js';

const Y0 = 1680;
const Y1 = 2030;

/** The genealogy of traditions as a navigable tree in time, lit by proximity. */
export function Lineage({ r }: { r: Result }) {
  const b = bundle.value!;
  const [sel, setSel] = useState<string | null>(r.affinities[0]?.tradition ?? null);
  const families = [...new Set(r.lineage.map((x) => x.family))];
  const W = 900;
  const rowH = 14;
  const x = (y: number) => 140 + ((Math.max(Y0, Math.min(Y1, y)) - Y0) / (Y1 - Y0)) * (W - 160);
  let row = 0;
  const rows: { id: string; name: string; y: number; x0: number; x1: number; p: number; family: string }[] = [];
  const famRows: { family: string; y: number }[] = [];
  for (const f of families) {
    famRows.push({ family: f, y: row * rowH });
    row++;
    // order within family: parents before children, by era
    const items = r.lineage.filter((t) => t.family === f).sort((a, z) => a.era[0] - z.era[0]);
    for (const t of items) {
      rows.push({ id: t.id, name: t.name, y: row * rowH, x0: x(t.era[0]), x1: x(t.era[1] ?? 2026), p: t.proximity, family: f });
      row++;
    }
    row += 0.5;
  }
  const H = row * rowH + 30;
  const aff = r.affinities.find((a) => a.tradition === sel);
  const P = (id: string) => b.positions[id]?.label ?? id;
  return (
    <div class="lineage">
      <p class="muted small">Each bar is a tradition, from its founding to its end (or today). Brighter means closer to your holdings. Select one to see where you agree and where you break.</p>
      <div class="lineage-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} class="lineage-svg" role="group" aria-label="Genealogy of traditions in time">
          {[1700, 1750, 1800, 1850, 1900, 1950, 2000].map((y) => (
            <g key={y}>
              <line x1={x(y)} x2={x(y)} y1={0} y2={H - 20} class="gridline" />
              <text x={x(y)} y={H - 6} text-anchor="middle" class="axis">
                {y}
              </text>
            </g>
          ))}
          {famRows.map((f) => (
            <text key={f.family} x={4} y={f.y + 11} class="family">
              {b.families[f.family]?.name ?? f.family}
            </text>
          ))}
          {rows.map((t) => (
            <g key={t.id} class={`lrow ${sel === t.id ? 'sel' : ''}`} tabIndex={0} role="button" aria-label={`${t.name}, proximity ${Math.round(t.p * 100)}%`} onClick={() => setSel(t.id)} onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && setSel(t.id)}>
              <rect x={t.x0} y={t.y + 2} width={Math.max(3, t.x1 - t.x0)} height={rowH - 4} rx={3} style={{ fill: `hsl(32 85% ${88 - t.p * 45}%)`, opacity: 0.25 + t.p * 0.75 }} />
              <text x={t.x0 - 4} y={t.y + 11} text-anchor="end" class="lname">
                {t.name.length > 30 ? t.name.slice(0, 29) + '…' : t.name}
              </text>
            </g>
          ))}
        </svg>
      </div>
      {sel && (
        <div class="card">
          <p class="headline">
            <a href={`#/explore/tradition/${sel}`}>{b.traditions[sel]?.name ?? sel}</a>
          </p>
          {aff ? (
            <>
              <p>
                You stand with them on {aff.agreements.length} question{aff.agreements.length === 1 ? '' : 's'} and break on {aff.breaks.length}.
              </p>
              {aff.agreements.length > 0 && <p>With them: {aff.agreements.map((a) => P(a.position)).join('; ')}</p>}
              {aff.breaks.length > 0 && <p class="muted">Breaks: {aff.breaks.map((x) => `${P(x.position)}${x.yours ? ` (you hold “${P(x.yours)}”)` : ''}`).join('; ')}</p>}
            </>
          ) : (
            <p class="muted">Nothing you hold so far touches this tradition.</p>
          )}
        </div>
      )}
    </div>
  );
}
