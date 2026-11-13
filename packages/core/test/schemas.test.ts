/** Exported sessions and results must validate against the published JSON Schemas. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { Engine, newSession, computeResult } from '../src/index.js';
import { fixture } from './fixture.js';

const here = dirname(fileURLToPath(import.meta.url));
const load = (f: string) => JSON.parse(readFileSync(join(here, '..', 'schemas', f), 'utf8'));
const ajv = new Ajv2020({ strict: false, allErrors: true });
ajv.addSchema(load('session.schema.json'));
const validateSession = ajv.getSchema('https://onodofthenorth.github.io/standpoint/schemas/session.schema.json')!;
const validateResult = ajv.compile(load('result.schema.json'));

function drive(mode: 'sketch' | 'survey' | 'excavation') {
  const b = fixture();
  const e = new Engine(b, newSession(b, { seed: 3, mode, now: '2026-01-01T00:00:00Z', respondent: { kind: 'ai', model: 'test-model', operator: 'ci', conditions: 'none' } }));
  e.setSituation('income', ['wages']);
  e.setSituation('world', 'core');
  let first = true;
  for (let i = 0; i < 60; i++) {
    const p = e.next().prompt;
    if (!p) break;
    if (first && p.premises.length) {
      e.answer({ node: p.id, affordance: 'reject', premise: p.premises[0]!.id });
      first = false;
      continue;
    }
    if (p.multi) e.answer({ node: p.id, options: [p.options[0]!.id] });
    else if (p.allocate) e.answer({ node: p.id, alloc: Object.fromEntries(p.allocate.items.map((it, k) => [it.id, k])) });
    else e.answer({ node: p.id, option: p.options[0]!.id });
  }
  e.dispute('serves', 'I do not accept this reading.');
  return { b, e };
}

describe('JSON Schemas', () => {
  for (const mode of ['sketch', 'survey', 'excavation'] as const) {
    it(`session and result validate (${mode})`, () => {
      const { b, e } = drive(mode);
      const session = JSON.parse(JSON.stringify(e.session));
      expect(validateSession(session), JSON.stringify(validateSession.errors)).toBe(true);
      const result = JSON.parse(JSON.stringify(computeResult(b, e.session, { now: '2026-01-02T00:00:00Z' })));
      expect(validateResult(result), JSON.stringify(validateResult.errors)).toBe(true);
    });
  }
});
