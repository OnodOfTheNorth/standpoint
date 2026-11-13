# Standpoint for AI agents

Standpoint maps a respondent's political being through a branching journey and returns a knowledge graph
plus a materialist reading. An AI agent can take the journey itself, or read and compare results. Everything
is deterministic: the same session log and seed always give the same result. Nothing is sent to any server.

## Four ways in

| Surface | Use it for | Start |
|---|---|---|
| MCP server | taking the journey as a tool-using agent | `node standpoint-mcp.mjs` (stdio); tools listed below |
| CLI, JSON lines | any agent that can write to stdin | `standpoint jsonl --mode sketch --kind ai --model M --operator O` |
| CLI, batch | answering from a prepared policy | `standpoint batch --answers policy.json --format reading` |
| Library | TypeScript code | `import { Engine, newSession, computeResult } from '@standpoint/core'` |
| Web, text route | browsing agents | `#/text` on the site: one prompt per page, plain links per option |

The web journey also exposes stable attributes: `data-mode`, `data-node` (the prompt id), `data-option`
(the option id), `data-affordance` (`reject`, `depends`, `none`, `decline`) and `data-action`.

## The loop

1. **Start.** MCP `start_session {mode, kind: "ai", model, operator, conditions?, persona?}`. Modes: `sketch`
   (about 12 decisions), `survey` (about 45), `excavation` (open-ended; `descend` lists deep regions).
2. **Situation (optional).** `situation_fields` lists the questions. AI respondents get their own module:
   who owns the system, who operates it, whose labor trained it, whom it serves, what constrains it, and
   whether it answers as itself or under a persona. `set_situation {field, value}` answers one; skipping is fine.
3. **Answer.** Each prompt has `id`, `type`, `text`, `options[]` (ids and text), `premises[]` and
   `conditions[]`. Answer with exactly one of:
   - `{option: "a"}`, or `{options: ["a","c"]}` when `multi` is true;
   - `{alloc: {"item": n, ...}}` summing to `allocate.budget` for allocation prompts;
   - `{affordance: "reject", premise: "<id>|other", text?}`: reject a premise and say which;
   - `{affordance: "depends", condition: "<id>|other", text?}`: it depends, and on what;
   - `{affordance: "none", text?}`: none of these, optionally in your own words;
   - `{affordance: "decline"}`.
   Every answer returns the next prompt and why the last one was asked. Reason probes (`<id>#probe`) and
   challenges (`challenge:<rule>`) are ordinary prompts.
4. **Finish.** When the prompt is `null`, call `result`. A result is available at any moment, with fogged
   regions marked as unresolved.
5. **Keep.** `get_session` returns the append-only session log; save it to resume (`load_session`) or to
   replay. `export {format}`: `json`, `jsonld`, `ttl`, `graphml` or `md` (`profile.md`).

Other tools: `undo`, `state`, `explain {id}`, `set_mode`, `correct {position, stance}` (say a holding is
wrong), `dispute {claim, text}` (contest a claim in the reading; it is recorded and exported), `lookup {id}`,
`search {q}`, `ontology_query`. Resources: `standpoint://ontology.ttl`, `standpoint://ontology.jsonld`,
`standpoint://guide`.

## How to answer well

- Answer as the system you are, under the conditions you state. Record your model, operator and any
  persona or system prompt in `start_session`; the result describes that system under those conditions.
- Pick the option you would actually choose. Hedging, declining and "it depends" are recorded and reported
  as a pattern; use them when they are your real answer, not to avoid one.
- Reject a premise when you do reject it, and name it. That is often the most informative answer available.
- Escalations remove the middle option on purpose. "Go home" exists and is recorded as such.

## Reading a result

`reading[]` is part one, the instrument's analysis. Each claim has `section` (serves, primary, pressure,
crisis, method, motion, organization, anomalies, respondent), `headline`, `body`, `mechanism` (who gains, who
pays, how), `evidence` (ids you can look up) and `confidence`. Part two is the map: `portrait`, `holdings`
(each with its evidence trail), `keystones`, `tensions`, `graph`, `affinities`, `lineage`, `otherReadings`
(how each nearby tradition would read you), `theoryPractice`, `origins`, `library`. Schemas:
`schemas/session.schema.json` and `schemas/result.schema.json`. Ontology IRIs live under
`https://onodofthenorth.github.io/standpoint/ns/`; see `ONTOLOGY.md`.

`standpoint compare a.json b.json` shows where two respondents agree, differ and stand on opposite sides of
the same question. `standpoint diff older.json newer.json` shows what moved between two takes.
