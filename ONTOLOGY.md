# Ontology

The Standpoint ontology is published as Turtle and JSON-LD, with stable IRIs, a JSON-LD context and JSON
Schemas. It is licensed CC BY-SA 4.0 (see `LICENSE-CONTENT`) and versioned with semantic versioning,
separately from the code.

- Namespace: `https://onodofthenorth.github.io/standpoint/ns/` (prefix `sp:`)
- Files on the site: `ns/ontology.ttl`, `ns/ontology.jsonld`, `ns/context.jsonld`, `data/bundle.json`,
  `schemas/*.schema.json`. The CLI prints the same with `standpoint ontology --format ttl|jsonld`, and the
  MCP server exposes them as resources.
- Reused vocabularies: SKOS for the tradition hierarchy and problematic concepts, PROV for evidence trails in
  results, Dublin Core terms for texts and metadata, RDFS and OWL for the vocabulary itself.

## IRIs

| Kind | Pattern | Example |
|---|---|---|
| Problematic | `sp:problematic/<id>` | `sp:problematic/state.nature` |
| Position | `sp:position/<id>` | `sp:position/state.nature.class-instrument` |
| Tradition | `sp:tradition/<id>` | `sp:tradition/marxism.leninism` |
| Family | `sp:family/<id>` | `sp:family/anarchism` |
| Thinker | `sp:thinker/<id>` | `sp:thinker/thinker.amin` |
| Event, debate | `sp:event/<id>`, `sp:debate/<id>` | `sp:debate/debate.calculation` |
| Text | `sp:text/<author-year-title slug>` | |
| Node | `sp:node/<id>` | `sp:node/arc.dock.03` |
| Social class | `sp:class/<id>` | `sp:class/comprador-capital` |

Ids are lowercase dotted slugs. A position id always begins with its problematic id. Ids are never reused for
a different meaning. When an entry is withdrawn its id is retired, and a session that referenced it replays
with that answer listed under `migrated`.

## Classes

`sp:Problematic` (a real question traditions disagree on) · `sp:Position` (one answer to a problematic) ·
`sp:Tradition` (with lineage; also a `skos:Concept` under its family) · `sp:Thinker` · `sp:Text` ·
`sp:Event` · `sp:Debate` · `sp:Node` (a step of the journey) · `sp:Stance` (a tradition's relation to a
position, with centrality) · `sp:Argument` (a thinker arguing a position in a text) · `sp:SocialClass` ·
and, for results, `sp:Result`, `sp:Holding`, `sp:Claim` (with `prov:Activity` for the session).

## Relations

| Property | Domain → range | Meaning |
|---|---|---|
| `sp:answers` | Position → Problematic | the question a position answers |
| `sp:presupposes`, `sp:excludes`, `sp:inTensionWith` | Position → Position | the structure of commitments |
| `sp:affirms`, `sp:rejects` | Tradition → Position | with an `sp:Stance` carrying `sp:centrality` (`defining`, `typical`, `contested-within`) |
| `sp:descendsFrom`, `sp:breaksWith` | Tradition → Tradition | lineage and splits, with event and date |
| `skos:broader` | Tradition → Tradition or family | taxonomy |
| `sp:argues` | Thinker → Position | via an `sp:Argument` with `sp:in` a `sp:Text` |
| `sp:takesSide` | Position → Debate | |
| `sp:gains`, `sp:pays` | Position → SocialClass | class content if the position prevails |

## The two blocks on every position

Description, in the tradition's voice: `sp:claim` (narrator's plain statement), `sp:voiced` (proponents'
idiom), `sp:because` (best argument), `sp:objection` (strongest objection, attributed), and
`dcterms:source` (real works).

Analysis, the instrument's reading: `sp:gains` and `sp:pays` (classes and fractions: finance, industrial,
landed and comprador capital; petty bourgeoisie; professional-managerial; core workers; peripheral workers;
peasantry; reserve army), `sp:mechanism` (how), `sp:drain` (`sustains`, `softens`, `none`, `reduces`,
`breaks`), `sp:lawOfValue` (`extends`, `regulates`, `none`, `suspends`, `abolishes`), and `sp:disputed`
(where materialists disagree on the reading, and who).

Traditions carry `sp:selfDescription`, `sp:record` (dated facts, disputed ones marked), lineage, and the
instrument's analysis: `sp:materialConditions`, `sp:classBase`, `sp:function`.

## Results as linked data

A result exported as JSON-LD or Turtle is an `sp:Result` with `sp:mode`, `sp:respondentKind`,
`sp:ontologyVersion` and `dcterms:date`. It links each `sp:Holding` (`sp:holdsPosition`, `sp:weight`,
`sp:confidence`) to the nodes that produced it through `prov:wasDerivedFrom`, and each `sp:Claim` of the
reading (`sp:section`, `sp:headline`, `sp:mechanism`, `sp:confidence`) to its evidence. A claim the
respondent contested carries `sp:disputedByRespondent`. GraphML exports the same graph for network tools,
and `profile.md` is a plain-text profile for people and language models.

## Versioning

`ontologyVersion` follows semantic versioning. Patch: wording, sources and analysis fixes. Minor: new
problematics, positions, traditions, nodes or relations. Major: a change to the meaning of an existing id or
to the shape of the schema. Every session records the content version it was taken against, and every result
records both versions.

## The content model behind it

The YAML sources live in `packages/content/data`, validated by the zod schema in
`packages/content/src/schema.ts`; the compiler emits the JSON Schemas for every file kind into
`packages/content/dist/schemas`. Contribution rules are in `CONTRIBUTING.md`.
