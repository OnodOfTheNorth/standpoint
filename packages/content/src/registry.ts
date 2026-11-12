import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export interface RegistryEntry {
  id: string;
  name: string;
  family: string;
  parent?: string;
  era: [number, number | null];
}
export interface Registry {
  families: { id: string; name: string }[];
  traditions: RegistryEntry[];
}

const here = dirname(fileURLToPath(import.meta.url));
export const contentRoot = join(here, '..');

export function loadRegistry(): Registry {
  const f = join(contentRoot, 'registry', 'traditions.yaml');
  if (!existsSync(f)) return { families: [], traditions: [] };
  return parse(readFileSync(f, 'utf8')) as Registry;
}

/** Position ids reserved in AUTHORING.md for the trunk and first arc. */
export function reservedCoreIds(): string[] {
  const f = join(contentRoot, 'registry', 'core-positions.txt');
  if (!existsSync(f)) return [];
  return readFileSync(f, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}
