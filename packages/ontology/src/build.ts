/** Write the ontology as Turtle, JSON-LD and the JSON-LD context into dist/ (release assets). */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Bundle } from '@standpoint/content/schema';
import { ontologyTurtle, ontologyJsonLd, jsonLdContext } from './index.js';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', 'content', 'dist', 'bundle.json');
if (!existsSync(src)) throw new Error('Run `pnpm content` first: packages/content/dist/bundle.json is missing');
const b = JSON.parse(readFileSync(src, 'utf8')) as Bundle;
const out = join(here, '..', 'dist');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'standpoint.ttl'), ontologyTurtle(b));
writeFileSync(join(out, 'standpoint.jsonld'), JSON.stringify(ontologyJsonLd(b), null, 1));
writeFileSync(join(out, 'context.jsonld'), JSON.stringify(jsonLdContext(b.base), null, 2));
console.log(`ontology ${b.ontologyVersion}: wrote dist/standpoint.ttl, standpoint.jsonld, context.jsonld`);
