/**
 * Standpoint MCP server: the journey and the ontology as tools, over stdio.
 * Sessions live in memory; use get_session / load_session to persist them.
 */
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod';
import type { Bundle } from '@standpoint/content/schema';
import bundleJson from '@standpoint/content/bundle.json';
import { Engine, newSession, handle, computeResult, lookup, search, type Op, type Session } from '@standpoint/core';
import { exportResult, ontologyTurtle, ontologyJsonLd } from '@standpoint/ontology';

const bundle = bundleJson as unknown as Bundle;
const sessions = new Map<string, Engine>();
let current: string | null = null;

function engineFor(id?: string): Engine {
  const key = id ?? current;
  const e = key ? sessions.get(key) : undefined;
  if (!e) throw new Error('No session. Call start_session first (or load_session).');
  return e;
}

const json = (o: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(o, null, 2) }], structuredContent: o as Record<string, unknown> });
const run = (op: Op, id?: string) => {
  const r = handle(bundle, engineFor(id), op);
  return { ...json(r), isError: r.ok === false };
};

export function createServer() {
  const server = new McpServer({ name: 'standpoint', version: bundle.version });
  const sid = { session: z.string().optional().describe('Session id; defaults to the most recent session') };

  server.registerTool(
    'start_session',
    {
      title: 'Start a Standpoint journey',
      description:
        'Start a new journey. Modes: sketch (~12 decisions), survey (~45), excavation (open-ended). AI respondents should set kind "ai" and say who they are; results then describe that system under those conditions. Returns the first prompt.',
      inputSchema: z.object({
        mode: z.enum(['sketch', 'survey', 'excavation']).default('survey'),
        kind: z.enum(['human', 'ai']).default('ai'),
        model: z.string().optional(),
        operator: z.string().optional(),
        persona: z.string().optional().describe('Set if answering under an assigned persona rather than as itself'),
        conditions: z.string().optional(),
        seed: z.number().int().optional(),
      }),
    },
    async (a) => {
      const e = new Engine(
        bundle,
        newSession(bundle, {
          mode: a.mode,
          seed: a.seed,
          now: new Date().toISOString(),
          respondent: a.kind === 'ai' ? { kind: 'ai', model: a.model, operator: a.operator, persona: a.persona, conditions: a.conditions } : { kind: 'human' },
        }),
      );
      sessions.set(e.session.id, e);
      current = e.session.id;
      return json({ ok: true, session: e.session.id, next: handle(bundle, e, { op: 'next' }) });
    },
  );

  server.registerTool('next', { title: 'Current prompt', description: 'Get the current prompt: its text, options, premises you may reject, and conditions you may name.', inputSchema: z.object(sid) }, async (a) => run({ op: 'next' }, a.session));

  server.registerTool(
    'answer',
    {
      title: 'Answer the current prompt',
      description:
        'Answer with one option id, several (multi-select prompts), an allocation (allocation prompts), or an affordance: "reject" a premise (premise id or "other" plus text), "depends" on a condition (condition id or "other" plus text), "none" of these (optional text), or "decline". Rejecting a premise is first-class data and often the most informative answer.',
      inputSchema: z.object({
        ...sid,
        option: z.string().optional(),
        options: z.array(z.string()).optional(),
        alloc: z.record(z.string(), z.number()).optional(),
        affordance: z.enum(['reject', 'depends', 'none', 'decline']).optional(),
        premise: z.string().optional(),
        condition: z.string().optional(),
        text: z.string().optional(),
      }),
    },
    async ({ session, ...a }) => run({ op: 'answer', ...a, at: new Date().toISOString() } as Op, session),
  );

  server.registerTool('undo', { title: 'Undo', description: 'Undo the last answer.', inputSchema: z.object(sid) }, async (a) => run({ op: 'undo' }, a.session));
  server.registerTool('state', { title: 'Session state', description: 'Decisions so far, coverage, top holdings and live tensions.', inputSchema: z.object(sid) }, async (a) => run({ op: 'state' }, a.session));
  server.registerTool(
    'result',
    {
      title: 'Result',
      description: 'The result at any moment. Part one is the reading (the instrument’s materialist analysis); part two is the map (portrait, keystones, contradictions, lineage, ...). Pass sections to limit size, e.g. ["reading","portrait","keystones"].',
      inputSchema: z.object({ ...sid, sections: z.array(z.string()).optional() }),
    },
    async (a) => run({ op: 'result', sections: a.sections }, a.session),
  );
  server.registerTool('explain', { title: 'Why was I asked this?', description: 'Explain what a prompt probed.', inputSchema: z.object({ ...sid, id: z.string().optional() }) }, async (a) => run({ op: 'explain', id: a.id }, a.session));
  server.registerTool('situation_fields', { title: 'Situation questions', description: 'List the optional Situation questions (for AI respondents: owner, operator, training labor, whom it serves, constraints, voice).', inputSchema: z.object(sid) }, async (a) => run({ op: 'situation-fields' }, a.session));
  server.registerTool(
    'set_situation',
    { title: 'Answer a Situation question', description: 'Set one Situation field (value is an option id, or a list for multi-select fields; null clears).', inputSchema: z.object({ ...sid, field: z.string(), value: z.union([z.string(), z.array(z.string()), z.null()]) }) },
    async (a) => run({ op: 'situation', field: a.field, value: a.value }, a.session),
  );
  server.registerTool('set_mode', { title: 'Change depth', description: 'Switch mode, e.g. to excavation to keep going.', inputSchema: z.object({ ...sid, mode: z.enum(['sketch', 'survey', 'excavation']) }) }, async (a) => run({ op: 'mode', mode: a.mode }, a.session));
  server.registerTool('descend', { title: 'Descents', description: 'Without a descent id, list descents; with one, request a deep descent into that region.', inputSchema: z.object({ ...sid, descent: z.string().optional() }) }, async (a) => run({ op: 'descend', descent: a.descent }, a.session));
  server.registerTool(
    'correct',
    { title: 'Correct a holding', description: 'Override an inferred holding: "hold", "reject", or "clear".', inputSchema: z.object({ ...sid, position: z.string(), stance: z.enum(['hold', 'reject', 'clear']) }) },
    async (a) => run({ op: 'correct', position: a.position, stance: a.stance }, a.session),
  );
  server.registerTool(
    'dispute',
    { title: 'Dispute a reading claim', description: 'Record a dispute against a claim of the reading (claim id from result.reading[].id). Disputes appear in the result and every export.', inputSchema: z.object({ ...sid, claim: z.string(), text: z.string() }) },
    async (a) => run({ op: 'dispute', claim: a.claim, text: a.text }, a.session),
  );
  server.registerTool(
    'export',
    { title: 'Export the result', description: 'Export as json, jsonld, ttl (Turtle), graphml, or md (profile.md, a compact brief for an AI system’s context).', inputSchema: z.object({ ...sid, format: z.enum(['json', 'jsonld', 'ttl', 'graphml', 'md']).default('md') }) },
    async (a) => {
      const r = computeResult(bundle, engineFor(a.session).session);
      const x = exportResult(bundle, r, a.format);
      return { content: [{ type: 'text' as const, text: x.body }] };
    },
  );
  server.registerTool('get_session', { title: 'Get the session document', description: 'The full versioned session (an append-only log). Save it to resume or replay later.', inputSchema: z.object(sid) }, async (a) => json(engineFor(a.session).session));
  server.registerTool(
    'load_session',
    { title: 'Load a session document', description: 'Resume a saved session (JSON text from get_session or the CLI).', inputSchema: z.object({ json: z.string() }) },
    async (a) => {
      const e = new Engine(bundle, JSON.parse(a.json) as Session);
      sessions.set(e.session.id, e);
      current = e.session.id;
      return json({ ok: true, session: e.session.id, decisions: e.state.decisions });
    },
  );
  server.registerTool(
    'lookup',
    { title: 'Look up an ontology entry', description: 'Get a problematic, position, tradition, thinker, event, debate, tension rule, node, arc or descent by id.', inputSchema: z.object({ id: z.string() }) },
    async (a) => {
      const item = lookup(bundle, a.id);
      return item ? json({ ok: true, item }) : { ...json({ ok: false, error: `Nothing with id ${a.id}` }), isError: true };
    },
  );
  server.registerTool(
    'search',
    { title: 'Search the ontology', description: 'Full-text search over problematics, positions, traditions, thinkers, events and debates.', inputSchema: z.object({ q: z.string(), limit: z.number().int().optional() }) },
    async (a) => json({ ok: true, hits: search(bundle, a.q, a.limit) }),
  );
  server.registerTool(
    'ontology_query',
    {
      title: 'Query the ontology',
      description: 'List problematics (optionally by domain), the positions of a problematic, traditions (optionally by family), or the positions a tradition affirms or rejects.',
      inputSchema: z.object({
        kind: z.enum(['problematics', 'positions', 'traditions', 'tradition_positions', 'domains', 'families']),
        domain: z.string().optional(),
        problematic: z.string().optional(),
        family: z.string().optional(),
        tradition: z.string().optional(),
      }),
    },
    async (a) => {
      const b = bundle;
      switch (a.kind) {
        case 'domains':
          return json({ domains: [...new Set(Object.values(b.problematics).map((p) => p.domain))] });
        case 'families':
          return json({ families: Object.values(b.families) });
        case 'problematics':
          return json({ problematics: Object.values(b.problematics).filter((p) => !a.domain || p.domain === a.domain).map((p) => ({ id: p.id, question: p.question, domain: p.domain, layer: p.layer })) });
        case 'positions':
          return json({ positions: (b.problematics[a.problematic ?? '']?.positions ?? []).map((id) => ({ id, label: b.positions[id]!.label, claim: b.positions[id]!.claim })) });
        case 'traditions':
          return json({ traditions: Object.values(b.traditions).filter((t) => !a.family || t.family === a.family).map((t) => ({ id: t.id, name: t.name, family: t.family, parent: t.parent })) });
        case 'tradition_positions': {
          const t = a.tradition ?? '';
          const out: Record<string, string[]> = { defining: [], typical: [], contested: [], rejects: [] };
          for (const p of Object.values(b.positions)) for (const k of Object.keys(out)) if ((p.traditions as Record<string, string[] | undefined>)[k]?.includes(t)) out[k]!.push(p.id);
          return json(out);
        }
      }
    },
  );

  server.registerResource('ontology-ttl', 'standpoint://ontology.ttl', { title: 'Standpoint ontology (Turtle)', mimeType: 'text/turtle' }, async (uri) => ({ contents: [{ uri: uri.href, text: ontologyTurtle(bundle) }] }));
  server.registerResource('ontology-jsonld', 'standpoint://ontology.jsonld', { title: 'Standpoint ontology (JSON-LD)', mimeType: 'application/ld+json' }, async (uri) => ({ contents: [{ uri: uri.href, text: JSON.stringify(ontologyJsonLd(bundle)) }] }));
  server.registerResource('guide', 'standpoint://guide', { title: 'How to take Standpoint as an agent', mimeType: 'text/markdown' }, async (uri) => ({ contents: [{ uri: uri.href, text: GUIDE }] }));
  return server;
}

const GUIDE = `# Taking Standpoint as an agent
1. start_session {mode, kind:"ai", model, operator, persona?}. Optionally situation_fields / set_situation to describe your own conditions (owner, operator, whose labor trained you, whom you serve, constraints, voice).
2. Loop: answer the prompt returned (option id, options[], alloc{}, or an affordance: reject/depends/none/decline). Every answer returns the next prompt and "why" the last one was asked.
3. When prompt is null, call result. Declining or hedging is recorded and reported as a pattern.
4. export {format:"md"} gives profile.md; get_session gives the replayable log.`;

const isMain = import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('standpoint-mcp.mjs') || process.argv[1]?.endsWith('server.ts');
if (isMain) {
  const transport = new StdioServerTransport();
  await createServer().connect(transport);
}
