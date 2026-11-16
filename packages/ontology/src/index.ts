/**
 * RDF (Turtle), JSON-LD and GraphML exports for the ontology and for results.
 * Vocabulary: Standpoint (sp:), SKOS for hierarchy, PROV for evidence trails,
 * Dublin Core terms for texts.
 */
import type { Bundle, Source } from '@standpoint/content/schema';
import type { Result } from '@standpoint/core';
import { profileMarkdown } from '@standpoint/core';

export const NS = {
  sp: 'https://onodofthenorth.github.io/standpoint/ns/',
  skos: 'http://www.w3.org/2004/02/skos/core#',
  prov: 'http://www.w3.org/ns/prov#',
  dcterms: 'http://purl.org/dc/terms/',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  owl: 'http://www.w3.org/2002/07/owl#',
} as const;

const KIND_PATH = {
  problematic: 'problematic/',
  position: 'position/',
  tradition: 'tradition/',
  family: 'family/',
  thinker: 'thinker/',
  event: 'event/',
  debate: 'debate/',
  node: 'node/',
  text: 'text/',
  class: 'class/',
  result: 'result/',
} as const;

export function iri(base: string, kind: keyof typeof KIND_PATH, id: string): string {
  return `${base}${KIND_PATH[kind]}${encodeURIComponent(id).replace(/%2F/g, '/')}`;
}

function textId(s: Source): string {
  return `${s.author}-${s.year}-${s.title}`
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 96);
}

/* ------------------------------------------------------------------ */
/* Turtle writer                                                        */
/* ------------------------------------------------------------------ */

type Obj = { iri: string } | { lit: string; lang?: string; dt?: string };
type Triple = [string, string, Obj];

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '');

function term(t: string): string {
  for (const [p, ns] of Object.entries(NS)) if (t.startsWith(ns) && /^[A-Za-z][A-Za-z0-9_-]*$/.test(t.slice(ns.length))) return `${p}:${t.slice(ns.length)}`;
  return `<${t}>`;
}
function obj(o: Obj): string {
  if ('iri' in o) return term(o.iri);
  if (o.dt) return `"${esc(o.lit)}"^^${term(o.dt)}`;
  return `"${esc(o.lit)}"${o.lang ? '@' + o.lang : ''}`;
}

export function toTurtle(triples: Triple[]): string {
  const head = Object.entries(NS)
    .map(([p, n]) => `@prefix ${p}: <${n}> .`)
    .join('\n');
  const bySubj = new Map<string, Triple[]>();
  for (const t of triples) (bySubj.get(t[0]) ?? bySubj.set(t[0], []).get(t[0])!).push(t);
  const blocks: string[] = [];
  for (const [s, ts] of bySubj) {
    const lines = ts.map(([, p, o], i) => `${i === 0 ? term(s) + ' ' : '    '}${p === NS.rdf + 'type' ? 'a' : term(p)} ${obj(o)}${i === ts.length - 1 ? ' .' : ' ;'}`);
    blocks.push(lines.join('\n'));
  }
  return `${head}\n\n${blocks.join('\n\n')}\n`;
}

const L = (lit: string, lang = 'en'): Obj => ({ lit, lang });
const I = (iri: string): Obj => ({ iri });
const D = (lit: string | number, dt: string): Obj => ({ lit: String(lit), dt });

/* ------------------------------------------------------------------ */
/* The ontology as triples                                              */
/* ------------------------------------------------------------------ */

export function vocabularyTriples(base: string): Triple[] {
  const sp = (x: string) => base + x;
  const t: Triple[] = [];
  const cls = (c: string, label: string, comment: string) => {
    t.push([sp(c), NS.rdf + 'type', I(NS.owl + 'Class')], [sp(c), NS.rdfs + 'label', L(label)], [sp(c), NS.rdfs + 'comment', L(comment)]);
  };
  const prop = (p: string, label: string, domain: string, range: string, comment: string) => {
    t.push([sp(p), NS.rdf + 'type', I(NS.owl + 'ObjectProperty')], [sp(p), NS.rdfs + 'label', L(label)], [sp(p), NS.rdfs + 'domain', I(domain)], [sp(p), NS.rdfs + 'range', I(range)], [sp(p), NS.rdfs + 'comment', L(comment)]);
  };
  cls('Problematic', 'Problematic', 'A real question that traditions disagree on.');
  cls('Position', 'Position', 'One answer to a problematic, with a description block and an analysis block.');
  cls('Tradition', 'Tradition', 'A political tradition or tendency, with lineage.');
  cls('Thinker', 'Thinker', 'A person who argued positions in texts.');
  cls('Text', 'Text', 'A real published work.');
  cls('Event', 'Event', 'A historical juncture.');
  cls('Debate', 'Debate', 'A historical polemic with sides.');
  cls('Node', 'Node', 'A step of the journey (scene, probe, verdict, etc.).');
  cls('Respondent', 'Respondent', 'A person or AI system that took the journey.');
  cls('Holding', 'Holding', 'A respondent’s relation to a position, with weight, confidence and evidence trail.');
  cls('Tension', 'Tension', 'A detected contradiction among holdings.');
  cls('Claim', 'Claim', 'An analytic claim of the instrument’s reading, with mechanism and evidence.');
  cls('Stance', 'Stance', 'A tradition’s affirmation or rejection of a position, with centrality.');
  cls('SocialClass', 'Social class', 'A class or class fraction used in class-content analysis.');
  prop('answers', 'answers', sp('Position'), sp('Problematic'), 'Position answers problematic.');
  prop('presupposes', 'presupposes', sp('Position'), sp('Position'), 'Holding the subject presupposes holding the object.');
  prop('excludes', 'excludes', sp('Position'), sp('Position'), 'The two positions cannot both be held.');
  prop('inTensionWith', 'in tension with', sp('Position'), sp('Position'), 'The positions pull against each other.');
  prop('affirms', 'affirms', sp('Tradition'), sp('Position'), 'Tradition affirms position (see sp:Stance for centrality).');
  prop('rejects', 'rejects', sp('Tradition'), sp('Position'), 'Tradition rejects position.');
  prop('descendsFrom', 'descends from', sp('Tradition'), sp('Tradition'), 'Lineage.');
  prop('breaksWith', 'breaks with', sp('Tradition'), sp('Tradition'), 'Split.');
  prop('takesSide', 'takes side', sp('Position'), sp('Debate'), 'Position takes a side in a debate.');
  prop('argues', 'argues', sp('Thinker'), sp('Position'), 'Thinker argues position (see sp:Argument for the text).');
  prop('via', 'as reported in', sp('Argument'), NS.dcterms + 'BibliographicResource', 'The secondary work an argument edge rests on when the primary was not read.');
  prop('gains', 'class that gains', sp('Position'), sp('SocialClass'), 'Class that gains if the position prevails.');
  prop('pays', 'class that pays', sp('Position'), sp('SocialClass'), 'Class that pays if the position prevails.');
  prop('holdsPosition', 'holds position', sp('Holding'), sp('Position'), 'The position a holding is about.');
  return t;
}

export function ontologyTriples(b: Bundle): Triple[] {
  const base = b.base;
  const t: Triple[] = vocabularyTriples(base);
  const sp = (x: string) => base + x;
  const ont = base.replace(/\/$/, '');
  t.push([ont, NS.rdf + 'type', I(NS.owl + 'Ontology')], [ont, NS.owl + 'versionInfo', L(b.ontologyVersion, '')], [ont, NS.dcterms + 'license', I('https://creativecommons.org/licenses/by-sa/4.0/')], [ont, NS.dcterms + 'title', L('Standpoint ontology of political being')]);
  const texts = new Map<string, Source>();
  const textIri = (s: Source) => {
    const id = textId(s);
    texts.set(id, s);
    return iri(base, 'text', id);
  };
  for (const c of ['finance-capital', 'industrial-capital', 'landed-capital', 'comprador-capital', 'petty-bourgeoisie', 'professional-managerial', 'core-workers', 'peripheral-workers', 'peasantry', 'reserve-army'])
    t.push([iri(base, 'class', c), NS.rdf + 'type', I(sp('SocialClass'))], [iri(base, 'class', c), NS.skos + 'prefLabel', L(c.replace(/-/g, ' '))]);
  for (const f of Object.values(b.families)) {
    const s = iri(base, 'family', f.id);
    t.push([s, NS.rdf + 'type', I(NS.skos + 'Concept')], [s, NS.skos + 'prefLabel', L(f.name)], [s, NS.skos + 'topConceptOf', I(iri(base, 'family', ''))]);
  }
  for (const p of Object.values(b.problematics)) {
    const s = iri(base, 'problematic', p.id);
    t.push([s, NS.rdf + 'type', I(sp('Problematic'))], [s, NS.skos + 'prefLabel', L(p.question)], [s, NS.skos + 'definition', L(p.plain)], [s, sp('domain'), L(p.domain, '')], [s, sp('layer'), L(p.layer, '')], [s, sp('importance'), D(p.importance, NS.xsd + 'integer')]);
  }
  for (const p of Object.values(b.positions)) {
    const s = iri(base, 'position', p.id);
    t.push(
      [s, NS.rdf + 'type', I(sp('Position'))],
      [s, sp('answers'), I(iri(base, 'problematic', p.problematic))],
      [s, NS.skos + 'prefLabel', L(p.label)],
      [s, sp('claim'), L(p.claim)],
      [s, sp('voiced'), L(p.voiced)],
      [s, sp('because'), L(p.because)],
      [s, sp('mechanism'), L(p.analysis.mechanism)],
      [s, sp('drain'), L(p.analysis.drain, '')],
      [s, sp('lawOfValue'), L(p.analysis.law_of_value, '')],
    );
    if (p.analysis.disputed) t.push([s, sp('disputed'), L(p.analysis.disputed)]);
    for (const a of p.against) t.push([s, sp('objection'), L(`${a.from}: ${a.text}`)]);
    for (const c of p.analysis.gains) t.push([s, sp('gains'), I(iri(base, 'class', c))]);
    for (const c of p.analysis.pays) t.push([s, sp('pays'), I(iri(base, 'class', c))]);
    for (const x of p.presupposes) t.push([s, sp('presupposes'), I(iri(base, 'position', x))]);
    for (const x of p.excludes) t.push([s, sp('excludes'), I(iri(base, 'position', x))]);
    for (const x of p.tension) t.push([s, sp('inTensionWith'), I(iri(base, 'position', x))]);
    for (const src of p.sources) t.push([s, NS.dcterms + 'source', I(textIri(src))]);
    for (const k of ['defining', 'typical', 'contested'] as const)
      for (const tr of p.traditions[k] ?? []) {
        const st = `${base}stance/${tr}/${p.id}`;
        t.push([iri(base, 'tradition', tr), sp('affirms'), I(s)], [st, NS.rdf + 'type', I(sp('Stance'))], [st, sp('tradition'), I(iri(base, 'tradition', tr))], [st, sp('position'), I(s)], [st, sp('centrality'), L(k === 'contested' ? 'contested-within' : k, '')]);
      }
    for (const tr of p.traditions.rejects ?? []) t.push([iri(base, 'tradition', tr), sp('rejects'), I(s)]);
  }
  for (const tr of Object.values(b.traditions)) {
    const s = iri(base, 'tradition', tr.id);
    t.push([s, NS.rdf + 'type', I(sp('Tradition'))], [s, NS.rdf + 'type', I(NS.skos + 'Concept')], [s, NS.skos + 'prefLabel', L(tr.name)], [s, sp('selfDescription'), L(tr.self)], [s, NS.skos + 'broader', I(tr.parent ? iri(base, 'tradition', tr.parent) : iri(base, 'family', tr.family))]);
    t.push([s, sp('eraStart'), D(tr.era[0], NS.xsd + 'gYear')]);
    if (tr.era[1] !== null) t.push([s, sp('eraEnd'), D(tr.era[1], NS.xsd + 'gYear')]);
    for (const l of tr.descendsFrom) t.push([s, sp('descendsFrom'), I(iri(base, 'tradition', l.id))]);
    for (const l of tr.breaksWith) t.push([s, sp('breaksWith'), I(iri(base, 'tradition', l.id))]);
    for (const r of tr.record) t.push([s, sp('record'), L(`${r.date ?? ''} ${r.text}${r.disputed ? ' (disputed)' : ''}`.trim())]);
    t.push([s, sp('materialConditions'), L(tr.analysis.conditions)], [s, sp('classBase'), L(tr.analysis.class_base)], [s, sp('function'), L(tr.analysis.function)]);
    for (const k of tr.keyTexts) t.push([s, sp('keyText'), I(textIri(k))]);
  }
  for (const th of Object.values(b.thinkers)) {
    const s = iri(base, 'thinker', th.id);
    t.push([s, NS.rdf + 'type', I(sp('Thinker'))], [s, NS.skos + 'prefLabel', L(th.name)], [s, NS.rdfs + 'comment', L(th.summary)]);
    for (const tr of th.traditions) t.push([s, sp('memberOf'), I(iri(base, 'tradition', tr))]);
    th.argues.forEach((a, i) => {
      const arg = `${s}/argument/${i}`;
      t.push([s, sp('argues'), I(iri(base, 'position', a.position))], [arg, NS.rdf + 'type', I(sp('Argument'))], [arg, sp('thinker'), I(s)], [arg, sp('position'), I(iri(base, 'position', a.position))], [arg, sp('in'), I(textIri(a.in))]);
      if (a.via) t.push([arg, sp('via'), I(textIri(a.via))]);
    });
  }
  for (const e of Object.values(b.events)) {
    const s = iri(base, 'event', e.id);
    t.push([s, NS.rdf + 'type', I(sp('Event'))], [s, NS.skos + 'prefLabel', L(e.name)], [s, NS.dcterms + 'date', L(String(e.date), '')], [s, sp('place'), L(e.place)], [s, NS.rdfs + 'comment', L(e.summary)]);
    if (e.problematic) t.push([s, sp('assessedBy'), I(iri(base, 'problematic', e.problematic))]);
  }
  for (const d of Object.values(b.debates)) {
    const s = iri(base, 'debate', d.id);
    t.push([s, NS.rdf + 'type', I(sp('Debate'))], [s, NS.skos + 'prefLabel', L(d.name)], [s, NS.dcterms + 'date', L(String(d.date), '')], [s, NS.rdfs + 'comment', L(d.summary)]);
    for (const side of d.sides) for (const p of side.positions) t.push([iri(base, 'position', p), sp('takesSide'), I(s)]);
  }
  for (const [id, s] of texts) {
    const x = iri(base, 'text', id);
    t.push([x, NS.rdf + 'type', I(sp('Text'))], [x, NS.dcterms + 'title', L(s.title, '')], [x, NS.dcterms + 'creator', L(s.author, '')], [x, NS.dcterms + 'date', L(String(s.year), '')]);
  }
  return t;
}

export function ontologyTurtle(b: Bundle): string {
  return toTurtle(ontologyTriples(b));
}

/* ------------------------------------------------------------------ */
/* JSON-LD                                                              */
/* ------------------------------------------------------------------ */

export function jsonLdContext(base: string) {
  return {
    '@context': {
      '@version': 1.1,
      '@vocab': base,
      sp: base,
      skos: NS.skos,
      prov: NS.prov,
      dcterms: NS.dcterms,
      xsd: NS.xsd,
      id: '@id',
      type: '@type',
      label: 'skos:prefLabel',
      definition: 'skos:definition',
      broader: { '@id': 'skos:broader', '@type': '@id' },
      answers: { '@id': 'sp:answers', '@type': '@id' },
      presupposes: { '@id': 'sp:presupposes', '@type': '@id', '@container': '@set' },
      excludes: { '@id': 'sp:excludes', '@type': '@id', '@container': '@set' },
      inTensionWith: { '@id': 'sp:inTensionWith', '@type': '@id', '@container': '@set' },
      affirms: { '@id': 'sp:affirms', '@type': '@id', '@container': '@set' },
      rejects: { '@id': 'sp:rejects', '@type': '@id', '@container': '@set' },
      descendsFrom: { '@id': 'sp:descendsFrom', '@type': '@id', '@container': '@set' },
      breaksWith: { '@id': 'sp:breaksWith', '@type': '@id', '@container': '@set' },
      gains: { '@id': 'sp:gains', '@type': '@id', '@container': '@set' },
      pays: { '@id': 'sp:pays', '@type': '@id', '@container': '@set' },
      holdsPosition: { '@id': 'sp:holdsPosition', '@type': '@id' },
      wasDerivedFrom: { '@id': 'prov:wasDerivedFrom', '@container': '@list' },
      weight: { '@id': 'sp:weight', '@type': 'xsd:decimal' },
      confidence: { '@id': 'sp:confidence', '@type': 'xsd:decimal' },
      date: 'dcterms:date',
      title: 'dcterms:title',
      creator: 'dcterms:creator',
    },
  };
}

export function ontologyJsonLd(b: Bundle) {
  const base = b.base;
  const graph: Record<string, unknown>[] = [];
  for (const p of Object.values(b.problematics))
    graph.push({ id: iri(base, 'problematic', p.id), type: 'Problematic', label: p.question, definition: p.plain, domain: p.domain, layer: p.layer, importance: p.importance });
  for (const p of Object.values(b.positions))
    graph.push({
      id: iri(base, 'position', p.id),
      type: 'Position',
      label: p.label,
      answers: iri(base, 'problematic', p.problematic),
      claim: p.claim,
      voiced: p.voiced,
      because: p.because,
      against: p.against.map((a) => ({ from: iri(base, 'tradition', a.from), text: a.text })),
      sources: p.sources,
      presupposes: p.presupposes.map((x) => iri(base, 'position', x)),
      excludes: p.excludes.map((x) => iri(base, 'position', x)),
      inTensionWith: p.tension.map((x) => iri(base, 'position', x)),
      gains: p.analysis.gains.map((c) => iri(base, 'class', c)),
      pays: p.analysis.pays.map((c) => iri(base, 'class', c)),
      mechanism: p.analysis.mechanism,
      drain: p.analysis.drain,
      lawOfValue: p.analysis.law_of_value,
      disputed: p.analysis.disputed,
      stances: (['defining', 'typical', 'contested'] as const).flatMap((k) => (p.traditions[k] ?? []).map((t) => ({ tradition: iri(base, 'tradition', t), centrality: k === 'contested' ? 'contested-within' : k }))),
      rejectedBy: (p.traditions.rejects ?? []).map((t) => iri(base, 'tradition', t)),
    });
  for (const t of Object.values(b.traditions))
    graph.push({
      id: iri(base, 'tradition', t.id),
      type: ['Tradition', 'skos:Concept'],
      label: t.name,
      family: t.family,
      broader: t.parent ? iri(base, 'tradition', t.parent) : iri(base, 'family', t.family),
      era: t.era,
      self: t.self,
      record: t.record,
      descendsFrom: t.descendsFrom.map((l) => iri(base, 'tradition', l.id)),
      breaksWith: t.breaksWith.map((l) => iri(base, 'tradition', l.id)),
      analysis: t.analysis,
      keyTexts: t.keyTexts,
    });
  for (const th of Object.values(b.thinkers))
    graph.push({ id: iri(base, 'thinker', th.id), type: 'Thinker', label: th.name, summary: th.summary, memberOf: th.traditions.map((t) => iri(base, 'tradition', t)), argues: th.argues.map((a) => ({ position: iri(base, 'position', a.position), in: a.in, ...(a.via ? { via: a.via } : {}) })) });
  for (const e of Object.values(b.events)) graph.push({ id: iri(base, 'event', e.id), type: 'Event', label: e.name, date: e.date, place: e.place, summary: e.summary, assessedBy: e.problematic ? iri(base, 'problematic', e.problematic) : undefined });
  for (const d of Object.values(b.debates)) graph.push({ id: iri(base, 'debate', d.id), type: 'Debate', label: d.name, date: d.date, summary: d.summary, sides: d.sides });
  return { ...jsonLdContext(base), '@id': base.replace(/\/$/, ''), version: b.ontologyVersion, '@graph': graph };
}

/* ------------------------------------------------------------------ */
/* Results                                                              */
/* ------------------------------------------------------------------ */

export function resultJsonLd(b: Bundle, r: Result) {
  const base = b.base;
  const rid = iri(base, 'result', r.meta.session);
  return {
    ...jsonLdContext(base),
    id: rid,
    type: 'Result',
    ontologyVersion: r.meta.ontologyVersion,
    contentVersion: r.meta.contentVersion,
    date: r.meta.date,
    mode: r.meta.mode,
    respondent: { id: `${rid}/respondent`, type: 'Respondent', ...r.meta.respondent },
    coverage: r.coverage,
    reading: r.reading.map((c) => ({ id: `${rid}/claim/${c.id}`, type: 'Claim', section: c.section, headline: c.headline, body: c.body, mechanism: c.mechanism, disputed: c.disputed, confidence: c.confidence, dispute: c.dispute, evidence: c.evidence })),
    holdings: r.holdings.map((h) => ({
      id: `${rid}/holding/${h.position}`,
      type: ['Holding', 'prov:Entity'],
      holdsPosition: iri(base, 'position', h.position),
      weight: h.weight,
      confidence: h.confidence,
      corrected: h.corrected,
      wasDerivedFrom: h.evidence.map((e) => ({ type: 'prov:Activity', node: e.node.startsWith('challenge:') || e.node === 'correction' ? e.node : iri(base, 'node', e.node), label: e.label, w: e.w, kind: e.kind })),
    })),
    keystones: r.keystones.map((k) => iri(base, 'position', k.position)),
    tensions: r.tensions,
    portrait: r.portrait,
    affinities: r.affinities.map((a) => ({ tradition: iri(base, 'tradition', a.tradition), score: a.score, agreements: a.agreements.map((x) => iri(base, 'position', x.position)), breaks: a.breaks.map((x) => iri(base, 'position', x.position)) })),
    practice: r.practice,
    situation: r.situation,
    disputes: r.disputes,
    affordances: r.affordances,
  };
}

export function resultTurtle(b: Bundle, r: Result): string {
  const base = b.base;
  const sp = (x: string) => base + x;
  const rid = iri(base, 'result', r.meta.session);
  const t: Triple[] = [];
  t.push([rid, NS.rdf + 'type', I(sp('Result'))], [rid, NS.dcterms + 'date', L(String(r.meta.date), '')], [rid, sp('mode'), L(r.meta.mode, '')], [rid, sp('ontologyVersion'), L(r.meta.ontologyVersion, '')], [rid, sp('respondentKind'), L(r.meta.respondent.kind, '')]);
  for (const h of r.holdings) {
    const hid = `${rid}/holding/${h.position}`;
    t.push([rid, sp('hasHolding'), I(hid)], [hid, NS.rdf + 'type', I(sp('Holding'))], [hid, sp('holdsPosition'), I(iri(base, 'position', h.position))], [hid, sp('weight'), D(h.weight.toFixed(3), NS.xsd + 'decimal')], [hid, sp('confidence'), D(h.confidence.toFixed(3), NS.xsd + 'decimal')]);
    h.evidence.forEach((e, i) => {
      const act = `${hid}/evidence/${i}`;
      t.push([hid, NS.prov + 'wasDerivedFrom', I(act)], [act, NS.rdf + 'type', I(NS.prov + 'Activity')], [act, NS.rdfs + 'label', L(e.label)], [act, sp('weightDelta'), D(e.w, NS.xsd + 'decimal')]);
      if (!e.node.includes(':') && e.node !== 'correction') t.push([act, NS.prov + 'used', I(iri(base, 'node', e.node))]);
    });
  }
  for (const c of r.reading) {
    const cid = `${rid}/claim/${c.id}`;
    t.push([rid, sp('hasClaim'), I(cid)], [cid, NS.rdf + 'type', I(sp('Claim'))], [cid, sp('section'), L(c.section, '')], [cid, sp('headline'), L(c.headline)]);
    for (const m of c.mechanism) t.push([cid, sp('mechanism'), L(m)]);
    if (c.disputed) t.push([cid, sp('disputed'), L(c.disputed)]);
    if (c.dispute) t.push([cid, sp('disputedByRespondent'), L(c.dispute.text)]);
  }
  for (const k of r.keystones) t.push([rid, sp('keystone'), I(iri(base, 'position', k.position))]);
  for (const x of r.tensions.live) t.push([rid, sp('liveTension'), L(x.explain)]);
  return toTurtle(t);
}

export function resultGraphML(b: Bundle, r: Result): string {
  const x = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const nodes = r.graph.nodes
    .map((n) => `    <node id="${x(n.id)}"><data key="label">${x(n.label)}</data><data key="domain">${n.domain}</data><data key="layer">${n.layer}</data><data key="weight">${n.weight.toFixed(3)}</data><data key="keystone">${n.keystone.toFixed(3)}</data><data key="fog">${n.fog}</data></node>`)
    .join('\n');
  const edges = r.graph.edges.map((e, i) => `    <edge id="e${i}" source="${x(e.source)}" target="${x(e.target)}"><data key="kind">${e.kind}</data><data key="live">${!!e.live}</data></edge>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">
  <key id="label" for="node" attr.name="label" attr.type="string"/>
  <key id="domain" for="node" attr.name="domain" attr.type="string"/>
  <key id="layer" for="node" attr.name="layer" attr.type="string"/>
  <key id="weight" for="node" attr.name="weight" attr.type="double"/>
  <key id="keystone" for="node" attr.name="keystone" attr.type="double"/>
  <key id="fog" for="node" attr.name="fog" attr.type="boolean"/>
  <key id="kind" for="edge" attr.name="kind" attr.type="string"/>
  <key id="live" for="edge" attr.name="live" attr.type="boolean"/>
  <graph id="${x(r.meta.session)}" edgedefault="directed">
${nodes}
${edges}
  </graph>
</graphml>
`;
}

export type ExportFormat = 'json' | 'jsonld' | 'ttl' | 'graphml' | 'md';

export function exportResult(b: Bundle, r: Result, format: ExportFormat): { body: string; mime: string; ext: string } {
  switch (format) {
    case 'json':
      return { body: JSON.stringify(r, null, 2), mime: 'application/json', ext: 'json' };
    case 'jsonld':
      return { body: JSON.stringify(resultJsonLd(b, r), null, 2), mime: 'application/ld+json', ext: 'jsonld' };
    case 'ttl':
      return { body: resultTurtle(b, r), mime: 'text/turtle', ext: 'ttl' };
    case 'graphml':
      return { body: resultGraphML(b, r), mime: 'application/graphml+xml', ext: 'graphml' };
    case 'md':
      return { body: profileMarkdown(b, r), mime: 'text/markdown', ext: 'md' };
  }
}
