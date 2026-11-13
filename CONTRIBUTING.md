# Contributing

Standpoint is only as good as its fidelity. The most valuable contribution is a dispute from someone who
holds a position and finds it misstated, or who opposes it and finds a strawman.

## Disputing an entry

1. Find the entry's id. Every position, tradition, thinker, event, debate and journey node shows its id in the
   explorer (`#/explore`), and every claim in a result links to the evidence it rests on.
2. Open an issue with the **Dispute an entry** template. Say what the entry says now, what it should say, and
   give real sources (author, title, year).
3. Say which tradition you speak from, if you like. It is optional, and it helps.

How disputes are judged:

- **Description** (`claim`, `voiced`, `because`, a tradition's self-description). The test is whether a
  committed proponent would sign it as their position, stated better than they would state it. Disputes from
  inside the tradition weigh most.
- **Objections** (`against`). The test is whether the opposing tradition would recognize it as its strongest
  objection, and whether it is attributed to the right tradition.
- **Facts and sources.** A dated fact needs a source. Where serious sources disagree, the entry states the range
  and marks it disputed rather than picking one.
- **Analysis** (`gains`, `pays`, `mechanism`, `drain`, `law_of_value`). The analysis is the instrument's own
  reading and follows the frame declared in `METHOD.md`. A dispute changes it by showing a better mechanism:
  who gains, who pays, and through what price, wage, rent, law or institution. A dispute that the frame itself
  is wrong is welcome too; it goes into `ANOMALIES.md` or the `disputed` field, where the frame's critics are cited.
- **Journey nodes.** A node fails if it signals a preferred answer, forces a frame without a way to reject the
  premise, misses an option real people choose, uses theory vocabulary, or moralizes.

## Changing content

Content is YAML in `packages/content/data`, validated by `packages/content/src/schema.ts`.

```
pnpm install
cd packages/content
npx tsx src/check.ts data/problematics/state.yaml   # check one file: schema, ids, loaded terms, sources
npx tsx src/compile.ts --strict                     # what CI runs
cd ../.. && pnpm test && pnpm typecheck
```

Rules the lints enforce:

- Ids are lowercase dotted slugs. A position id starts with its problematic id. Tradition ids come only from
  `packages/content/registry/traditions.yaml`. Never change the meaning of an existing id.
- The narrator (claims, node text, consequences, records, summaries, analysis) uses plain description. "Regime",
  "strongman", "extremist", "moderate", "free world", "developing countries", "third world", and unqualified
  "freedom" or "democracy" belong only inside a tradition's own voice.
- Every source has an author, title and year of first publication. Cite only works you have confirmed exist.
- Every position has a full analysis block. Every arc has an escalation whose options all take a side. Every
  pressure scene states what each choice costs. At most 70 words before a choice.
- Every position must be reachable from at least three nodes, and every leaf tradition must have at least one
  defining position.

Rules the lints cannot enforce, and reviewers will:

- Siblings differ on something that matters in practice. No mush, and no "it's complicated" as a position.
- No horseshoe geometry, no "authoritarian versus libertarian" master axis, no "totalitarianism" as a neutral
  category, no markets equated with capitalism, no state ownership equated with socialism.
- The Global South holds most of humanity. Scenes, events and traditions should reflect that.
- Common sense counts. A position held by people with no school deserves the same care as a theorist's.

## Changing code

TypeScript strict, pnpm workspaces. `packages/core` is the engine (deterministic: no clocks, no randomness
outside the seeded generator, no network). `apps/cli`, `apps/mcp` and `apps/web` are thin surfaces over the
shared protocol in `packages/core/src/protocol.ts`. Run `pnpm test`, `pnpm typecheck` and, for the web,
`pnpm e2e`. The site makes no third-party requests and keeps no accounts or telemetry; keep it that way.

## License

By contributing you agree that code contributions are licensed under AGPL-3.0 and content contributions under
CC BY-SA 4.0, as described in `LICENSE` and `LICENSE-CONTENT`.
