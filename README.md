# Standpoint

Standpoint maps a person's political being, not just their opinions. You take a branching journey of scenes,
verdicts on real history, trade-offs and arguments between people at full strength. The result is a
knowledge graph and a reading of it: what your commitments rest on, whose interests they serve, where they
contradict each other, what you do when they cost something, and which traditions you descend from.

There are no axes and no label at the end. Every claim in the reading opens its evidence trail, and every
entry in the ontology can be disputed.

**Site:** https://onodofthenorth.github.io/standpoint/ (runs entirely in your browser: no accounts, no server,
no telemetry, no third-party requests).

## Three modes

| Mode | Length | What it is for |
|---|---|---|
| Sketch | about 12 decisions | a first picture: keystones, the sharpest contradiction |
| Survey | about 45 decisions | a full map that separates neighboring traditions |
| Excavation | open-ended | descents into deep regions (planning, the communist tendencies, feminisms, liberalisms, religious politics…) |

You can reject a premise, answer "it depends" and name the condition, or decline any prompt. The optional
Situation form (class position, the country's place in the world economy, nation, housing, debt…) is kept out
of share links by default.

## What is in it

| | count |
|---|---|
| problematics (questions with their full range of answers) | 173 |
| positions | 1,250 |
| leaf traditions, each with its history, record and defining positions | 160 |
| thinkers, each argument citing a real work | 112 |
| historical events with tradition stances | 85 |
| debates, each side argued at full strength | 57 |
| journey nodes (trunk, arcs, probes, pressure scenes, descents) | 869 |
| narrative arcs that escalate a situation over several scenes | 24 |
| descents (gated deep trees) | 12 |
| tension rules that confront a respondent with their own contradictions | 168 |

Every position is reachable from at least three nodes, and every descent and tradition is reachable; CI
enforces this.

## Use it

```sh
pnpm install
pnpm content                 # compile the content into packages/content/dist/bundle.json
pnpm test                    # engine, schema and persona tests
pnpm typecheck

# take the journey in a terminal
npx tsx apps/cli/src/main.ts --mode sketch

# answer from a prepared policy and print the reading
npx tsx apps/cli/src/main.ts batch --answers policy.json --mode survey --format reading

# MCP server over stdio, for AI agents taking the instrument
npx tsx apps/mcp/src/server.ts

# the web app
cd apps/web && npx tsx scripts/prepare-data.ts && npx vite
```

Results export as JSON, JSON-LD, Turtle, GraphML and `profile.md`. The ontology is published as Turtle and
JSON-LD with stable IRIs, SKOS and PROV, with JSON Schemas for sessions and results.

## Layout

| Path | What |
|---|---|
| `packages/content` | the ontology and journey as YAML (`data/`), the schema, compiler and lints |
| `packages/core` | the engine: state replay, adaptive selection, holdings, structure, the reading, the map, share links, glyphs |
| `packages/ontology` | Turtle, JSON-LD and GraphML exports |
| `apps/cli`, `apps/mcp`, `apps/web` | the three ways to take it |

## Documents

- [METHOD.md](METHOD.md): what the instrument measures, why, and its own standpoint stated openly
- [ONTOLOGY.md](ONTOLOGY.md): the data model and IRIs
- [ANOMALIES.md](ANOMALIES.md): known weaknesses, what the persona and fidelity tests found
- [AGENTS-GUIDE.md](AGENTS-GUIDE.md) and [llms.txt](llms.txt): for AI agents taking the instrument
- [CONTRIBUTING.md](CONTRIBUTING.md): how to dispute an entry or add content
- [DECISIONS.md](DECISIONS.md): design decisions with their reasons

## License

Code: [AGPL-3.0](LICENSE). Content and ontology: [CC BY-SA 4.0](LICENSE-CONTENT). Copyright george navarre.
