# Decisions

One line of reasoning per decision. Newest at the bottom.

- **Build in `./standpoint/`.** The working folder already held other projects.
- **Author identity: `george navarre <georgenavarrecoding@gmail.com>`, set repo-local.** Global `user.name` was unset; this is the identity the owner already uses in other local repositories.
- **pnpm workspaces with packages consumed as TypeScript source.** Vite, Vitest and tsx resolve source directly, so there is no inner build step to drift.
- **zod for the content schema; JSON Schemas generated from it.** One definition validates YAML at compile time and publishes machine-readable schemas.
- **Positions are nested inside their problematic in YAML.** An author sees the full spread of answers to one question at once, which is what fidelity review needs.
- **Tradition ids live in a registry file separate from full entries.** Many authors can reference traditions in parallel before the entries exist.
- **Reserved core position ids.** The trunk and first arc were written before the domain content and needed stable targets.
- **Holding weights: per problematic, resolution = 1 − e^(−evidence mass / 3), and the positive evidence shares that resolution.** Several positions can be held at once, unresolved mass stays explicit, and one strong answer counts as a first guess, not a certainty.
- **Hold threshold 0.25.** A single clear answer registers; a weak lean does not.
- **Probes and follow-ups do not count toward the mode's decision budget.** They are sub-questions of one decision, and counting them would cut a Sketch to six scenes.
- **Sketch enters one arc's escalation standalone, using the node's `recap`.** A full arc would not fit in about 12 decisions, but the crisis choice is the most predictive datum and must be collected in every mode.
- **Survey and Excavation follow a slot template (practice, arc, pressure, arc, trajectory, descent, ...) and fill the rest by expected fog reduction.** This gives each mode a predictable shape while the selection stays adaptive.
- **Challenges are opportunistic, with per-mode quotas (1 / 4 / unlimited), and never interrupt an arc.** Narrative continuity outranks the hunt for contradictions.
- **Undo is an event in the log, not a deletion.** It keeps the session append-only, as the brief requires.
- **Class location is derived from Situation by explicit precedence: ownership outranks the wage relation, and a worker who rents out one flat stays a worker.** The rule is legible and disputable, and it covers the "landlord socialist" case.
- **Reading claims are generated from per-position mechanisms, never from tradition labels.** This enforces "mechanism or silence" and "no taxonomy as verdict" structurally.
- **The labor-aristocracy dispute is stated in full on every core-country drain claim.** This is the brief's "accuracy over line" rule applied where the frame is most contested.
- **Share links carry the deflated session log in the URL fragment and strip Situation by default.** A fragment never reaches any server, and situation data is the most sensitive.
- **Web: Preact plus a tiny signal, hash routing, d3-force for the map.** It is small, static, deploys to GitHub Pages with no server rewrites, and makes no third-party requests.
- **The bundle is fetched from the same origin at runtime instead of being inlined into JS.** This keeps the JS small and lets the dataset be downloaded as a file.
- **MCP server on the current SDK (v2: `@modelcontextprotocol/server`, zod 4).** The SDK docs show v2 as current; v1 is maintenance-only.
- **CLI, MCP and library share one protocol module in core.** All three agent surfaces behave identically.
- **No LLM at runtime anywhere.** The brief requires determinism; same log and seed give the same result.
- **Ontology IRIs under `https://onodofthenorth.github.io/standpoint/ns/`.** They are stable, and the Pages site serves the Turtle and JSON-LD at that path.
- **Arcs planned (24):** night shift (warehouse), the plant (a town losing its factory), IMF conditions, the blockade (first year of a revolution), the pipeline (indigenous land), the surge (far right before an election), rent strike, parish split, land reform, automation, the founder (sell to the workers?), coup, the mine (miners win control; price rises abroad), the clinic (privatization), border town, temple and reservation (caste), uprising after a police killing, war mobilization, microfinance debt, flood reconstruction, platform drivers' strike, campus occupation, a family's law (abortion/marriage in a religious community), and the annotators (AI labor). They span six continents.
- **JSON Schemas for session and result are hand-written (draft 2020-12) and tested with ajv against exports from all three modes.** The result's map sections stay loosely typed so the schema documents the contract without freezing internal analysis shapes.
- **CI runs `compile --strict`, tsc, Vitest, the site build and Playwright in one job; Pages deploys from a separate workflow.** A red content lint blocks merges, and a deploy never waits on e2e flakiness.
- **LICENSE carries AGPL-3.0 for code and LICENSE-CONTENT carries CC BY-SA 4.0 for content, registry and ontology, both copyright the owner.** The split is the brief's, and a header in each file says which paths it covers.
- **The dispute issue template asks for the entry id, the kind of error (description, objection, fact, source, analysis, journey, missing) and a proposed wording.** Description disputes from inside a tradition weigh most, which is the fidelity rule turned into process.
