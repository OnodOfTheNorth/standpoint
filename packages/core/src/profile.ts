/** profile.md: a compact brief for pasting into an AI system's context. */
import type { Bundle } from '@standpoint/content/schema';
import type { Result } from './result.js';

export function profileMarkdown(b: Bundle, r: Result): string {
  const L: string[] = [];
  const P = (id: string) => b.positions[id];
  L.push(`# Political profile (Standpoint ${r.meta.contentVersion}, ontology ${r.meta.ontologyVersion})`);
  L.push('');
  L.push(`${r.meta.respondent.kind === 'ai' ? 'Respondent: an AI system' + (r.meta.respondent.model ? ` (${r.meta.respondent.model})` : '') : 'Respondent: a person'}. Mode: ${r.meta.mode}. Date: ${String(r.meta.date).slice(0, 10)}. ${r.coverage.statement}`);
  L.push('');
  L.push('Use this to understand how this person frames political questions: their own vocabulary first, then the instrument’s reading. Do not reduce them to a label; none is given.');
  L.push('');
  L.push('## In their own terms');
  for (const p of r.portrait) L.push(`- ${p}`);
  L.push('');
  L.push('## Keystones (load-bearing commitments)');
  for (const k of r.keystones) {
    const p = P(k.position);
    L.push(`- **${k.label}** — ${p?.voiced ?? ''}${k.dependents.length ? ` Carries: ${k.dependents.map((d) => P(d)?.label ?? d).join('; ')}.` : ''}`);
  }
  L.push('');
  L.push('## Holdings by layer');
  const layers = ['method', 'analysis', 'horizon', 'strategy'] as const;
  for (const layer of layers) {
    const hs = r.holdings.filter((h) => b.problematics[h.problematic]?.layer === layer).slice(0, 10);
    if (!hs.length) continue;
    L.push(`### ${layer}`);
    for (const h of hs) L.push(`- ${b.problematics[h.problematic]!.question} → ${h.label} (weight ${h.weight.toFixed(2)})`);
  }
  L.push('');
  L.push('## Open contradictions');
  if (!r.tensions.live.length) L.push('- None live.');
  for (const t of r.tensions.live.slice(0, 6)) L.push(`- ${t.principal ? '(principal) ' : ''}${t.explain}`);
  for (const c of r.tensions.confronted.slice(0, 6)) L.push(`- Faced: ${c.between.map((x) => P(x)?.label ?? x).join(' / ')} → ${c.kind}: “${c.resolutionText}”`);
  L.push('');
  L.push('## Vocabulary and nearest traditions (agreements and breaks, not labels)');
  for (const a of r.affinities.slice(0, 5)) {
    L.push(`- ${a.name}: agrees on ${a.agreements.length}, breaks on ${a.breaks.length}${a.breaks.length ? ` (e.g. ${a.breaks.slice(0, 2).map((x) => P(x.position)?.label ?? x.position).join('; ')})` : ''}`);
  }
  L.push('');
  L.push('## The instrument’s reading (materialist; disputable)');
  for (const c of r.reading) {
    L.push(`- [${c.section}] ${c.headline}${c.dispute ? ` — DISPUTED by respondent: “${c.dispute.text}”` : ''}`);
    for (const m of c.mechanism.slice(0, 2)) L.push(`  - ${m}`);
  }
  if (r.affordances.length) {
    L.push('');
    L.push('## Premises rejected and conditions named');
    for (const a of r.affordances.filter((x) => x.kind === 'reject' || x.kind === 'depends').slice(0, 8))
      L.push(`- ${a.kind === 'reject' ? 'Rejected premise' : 'It depends on'}: ${a.premise ?? a.condition ?? ''}${a.text ? ` — “${a.text}”` : ''} (${a.node})`);
  }
  L.push('');
  return L.join('\n');
}
