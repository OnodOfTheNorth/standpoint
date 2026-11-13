/** Copy the compiled bundle and ontology exports into public/ for the static site. */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Bundle } from '@standpoint/content/schema';
import { ontologyTurtle, ontologyJsonLd, jsonLdContext } from '@standpoint/ontology';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const pub = join(here, '..', 'public');
const src = join(root, 'packages', 'content', 'dist', 'bundle.json');
if (!existsSync(src)) throw new Error('Run `pnpm content` first: packages/content/dist/bundle.json is missing');
mkdirSync(join(pub, 'data'), { recursive: true });
mkdirSync(join(pub, 'ns'), { recursive: true });
mkdirSync(join(pub, 'schemas'), { recursive: true });
copyFileSync(src, join(pub, 'data', 'bundle.json'));
const b = JSON.parse(readFileSync(src, 'utf8')) as Bundle;
writeFileSync(join(pub, 'ns', 'ontology.ttl'), ontologyTurtle(b));
writeFileSync(join(pub, 'ns', 'ontology.jsonld'), JSON.stringify(ontologyJsonLd(b)));
writeFileSync(join(pub, 'ns', 'context.jsonld'), JSON.stringify(jsonLdContext(b.base), null, 2));
const schemaDir = join(root, 'packages', 'content', 'dist', 'schemas');
if (existsSync(schemaDir)) for (const f of readdirSync(schemaDir)) copyFileSync(join(schemaDir, f), join(pub, 'schemas', f));
const coreSchemas = join(root, 'packages', 'core', 'schemas');
if (existsSync(coreSchemas)) for (const f of readdirSync(coreSchemas)) copyFileSync(join(coreSchemas, f), join(pub, 'schemas', f));
for (const f of ['llms.txt', 'AGENTS-GUIDE.md', 'METHOD.md', 'ONTOLOGY.md']) if (existsSync(join(root, f))) copyFileSync(join(root, f), join(pub, f));
console.log(`public/ prepared: ${Object.keys(b.positions).length} positions, ${Object.keys(b.nodes).length} nodes`);
