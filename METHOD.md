# Method

Every instrument that maps politics has a standpoint. Most hide it inside their axes. This one states its own,
keeps it apart from the description of the traditions it maps, and gives every tradition a route to dispute
its entry.

## 1. What is wrong with the usual instruments

Political Compass, 8values and their descendants share one design: agree or disagree with abstract
propositions, sum the answers onto axes, print a label. That design fails in nine ways, and each failure is a
requirement here.

1. It measures opinion, not political being: where a person stands in social relations, what they do, how they
   reason, and what they do when their commitments collide.
2. Its axes ("economic left/right" against "authoritarian/libertarian") are one tradition's picture of politics
   drawn as geometry. Every other tradition appears as a distance from it.
3. It has no place for class, nation, a country's place in the world economy, imperialism as a structure, a
   theory of history, strategy or practice.
4. Its propositions speak one idiom, so most respondents must mistranslate themselves to answer.
5. It forces the frame: no one can reject a premise.
6. It sums independent items, when real commitments form a structure in which some carry the others.
7. It assumes a static, coherent person. People move and hold contradictions, and the contradictions are the
   most informative part.
8. It outputs a label, which ends inquiry.
9. It treats ideas as free-floating and never asks where a thought came from, whose interests it serves or
   what it does in the world.

## 2. The model

A result has eight layers, each recorded separately.

| Layer | What is recorded | How it is collected |
|---|---|---|
| Situation | income source, authority over others' labor, assets, debt, housing, sector, union; the country's place in the world economy; nation, settler or indigenous, migrant status, caste, race and gender as lived structures; place, generation, religion | an optional, skippable form |
| Method | what moves history, what society is made of, conflict, human nature, knowledge | explanation nodes and reason probes; the kind of cause reached for is tallied |
| Analysis | what capitalism, the state, poverty, imperialism and the past are | explanation and verdict nodes |
| Horizon | property, allocation, work, the state, family, nation, ecology, technology, the sacred | scenes, trade-offs, allocations |
| Strategy | agent, organization, reform or revolution, alliances, means, tempo | scenes and arcs |
| Practice | organizations and actions, collective or individual | a practice module |
| Priority | what gives way when commitments collide or cost something | trade-offs, pressure scenes, escalations |
| Trajectory | where a person came from, what moved them, the origin of each keystone belief | trajectory module and origin questions |

The ontology holds about 120 problematics (real questions traditions disagree on), each with five to eight
positions. Every position has a description block, written in its proponents' own voice, and an analysis
block, which is the instrument's reading. Positions carry typed relations: `presupposes`, `excludes`,
`inTensionWith`. Traditions affirm or reject positions with a centrality (defining, typical, contested).

## 3. How evidence becomes a map

- Each option in a scene carries weighted evidence for or against specific positions. Reason probes ask why
  an option was chosen, because the same choice made for different reasons is different politics.
- For every problematic the engine keeps positive evidence per position and an explicit unresolved mass.
  Resolution is `1 − e^(−evidence / 3)`, and positions share that resolution in proportion to their
  positive evidence. Several positions on one question can be held at once. A position counts as held at a
  weight of 0.25: one clear answer registers as a first guess, not a certainty.
- Rejecting a premise, saying "it depends" and naming the condition, choosing "none of these", and declining
  are all recorded as data, never as missing answers. Undecided, never thought about it, centrist by conviction,
  and holding both sides of a real contradiction are four different states and are recorded differently.
- Keystones are held positions that carry others: they weigh most when many other holdings presuppose them,
  when they sit on load-bearing questions, and when they are backed by several answers.
- Tensions are detected by explicit rules (logical, principle against application, strategy against horizon,
  theory against practice, position against consciousness). The engine confronts the respondent with them
  and records the response: one side gives way, both are held with a reason, the framing is rejected, or a
  condition is named.
- The engine is deterministic. The same session log and seed produce the same result, byte for byte. No
  language model runs anywhere at runtime.

## 4. Fidelity: describing traditions

Every tradition appears in its own best voice. A position's `voiced` line is how a committed proponent says
it; `because` is the strongest argument they would give; `against` is the strongest objection, attributed to
the tradition that makes it; `sources` are real works. A position passes review when a proponent would sign
it, an opponent would recognize the real target, it differs from its siblings on something that matters in
practice, and a plain reader understands it.

The narrator, meaning every line not spoken by a tradition, uses plain description. Words like "regime",
"strongman", "extremist", "moderate", "free world", "developing countries", and unqualified "freedom" or
"democracy" appear only inside a tradition's own voice. A content lint enforces this.

Every result shows the person in their own tradition's terms first: the portrait, the keystones in their own
words, their nearest traditions and thinkers, and how each tradition they are near would read them. Only then
does it give the instrument's reading, clearly marked.

## 5. The standpoint: the instrument's own analysis

The reading is materialist. It treats the frame below as the current best account, uses it to ask
questions, and draws its verdicts from the concrete evidence of each session.

**The frame.**
- Capitalism is production organized around profit. Markets and trade are far older and are not the same thing.
- The capitalist law of value steers labor and resources toward what is most profitable to capital, blindly,
  through competition and world prices. Mass deprivation amid abundance, ecological breakdown and imperial
  violence are three symptoms of that one law.
- Accumulation in the core rests on unequal exchange with the periphery, enforced by monopolies over
  technology, finance, access to resources, media and weapons of mass destruction (Samir Amin). Finance binds tightest.
- Imperialism rules the periphery through comprador classes: local ruling fractions that broker the drain and
  share in it. Class struggle in the periphery is therefore also anti-imperialist struggle.
- Sovereign development in the South raises supply prices and squeezes core profits, which is why it draws
  sanctions, coups and war.
- Concessions to workers in the core were funded by the drain and forced by the threat of revolution. As the
  drain is contested, core capital turns on its own workers, and where no socialist movement organizes that
  anger, fascism does.
- Imperialism is the primary contradiction of the present. Transitional and besieged states are judged by
  their direction and their place in the whole, not against a finished ideal with the siege left out.
- The goal the frame measures toward is production for human need and ecological stability under
  democratic planning, with labor power no longer a commodity, on a world scale.

Sources: Marx, *Capital* (1867); Lenin, *Imperialism* (1917) and *The State and Revolution* (1917); Gramsci,
*Prison Notebooks* (1929–35); Mao, *On Contradiction* and *On Practice* (1937); Amin, *Unequal Development*
(1973), *Delinking* (1985), *The Law of Worldwide Value* (2010); Emmanuel, *Unequal Exchange* (1969);
Rodney, *How Europe Underdeveloped Africa* (1972); Fanon, *The Wretched of the Earth* (1961); Hickel,
*The Divide* (2017) and *Less Is More* (2020); Hickel and co-authors on drain from the global South (2021, 2022).

**The five questions.** From that frame the reading answers five questions no opinion survey asks.

1. *Whom do your politics serve?* Every position records which classes and class fractions gain and which pay
   if it prevails, and the mechanism. The engine sums this across a person's holdings and sets it beside their
   Situation. Findings name the mechanism every time: a wage worker carrying a landlord's program, a small
   owner whose anger at monopoly is channeled against migrants.
2. *Where do you stand in the primary contradiction?* Every position records its effect on the drain from
   periphery to core (sustains, softens, none, reduces, breaks). A person can be far left on every domestic
   question and still defend the drain; the reading can see that and say it.
3. *What do you do when it costs you?* Pressure scenes, chosen from Situation, put the respondent's material
   interest against a stated principle, with the cost stated. The reading reports where principle held and
   where interest won.
4. *Which way do you break when the center fails?* Every arc has an escalation in which the middle option
   disappears. The reading reports the direction taken: with property and order or with labor and the
   dispossessed, with the empire or with the colony.
5. *Where are you going?* Live tensions are classed as principal or secondary. With trajectory, tension
   resolutions and crisis behavior, the reading states which commitments are hardening, which are giving way,
   and which conditions would push further. It reads the level of consciousness with Gramsci's three moments:
   economic-corporate (one's own trade or group), class-economic (solidarity across a class on economic
   ground), hegemonic (a program for the whole society and a claim on state power).

It also reads **method from behavior**: the kind of cause a person reaches for in explanation nodes and reason
probes (bad individuals, bad ideas, culture, nature, providence, chance, interests, structures). That is
their working philosophy, whatever they call themselves.

**Discipline.**
- No taxonomy as verdict. The reading never judges a person by the shelf their views sit on. It reasons from
  concrete holdings, Situation, practice and behavior under pressure, and its claims are generated from the
  mechanisms of individual positions, never from tradition labels.
- Mechanism or silence. Every claim names who gains, who pays, and how.
- Accuracy over line. Where materialists are split (the labor aristocracy, the class character of China, the
  national bourgeoisie), the reading takes the frame's line, names the dispute and cites both sides.
- Anomalies are reported. When a respondent contradicts what the frame predicts, the result says so plainly,
  as a finding about the person and a test of the frame. Recurring cases are collected in `ANOMALIES.md`.
- Plain speech. The reading says what a person's politics do. It does not tell them what to feel about it.
- Contestable. Any claim in the reading can be disputed in the result. The dispute is recorded and exported
  with the result.

## 6. What the journey never does

The journey signals no preferred answer, moralizes about nothing, and keeps no score. Every option is one a
real person picks for real reasons. The analysis arrives only in the results.

## 7. Limits

- The class-content and drain readings on each position are judgments. They are written down, mechanism
  included, so that they can be checked and disputed one by one.
- A Sketch resolves little of the map and says so. Unresolved regions are shown fogged, not guessed.
- Situation is self-reported and coarse. Class location is derived by explicit rules (ownership outranks the
  wage relation; a worker who rents out one flat stays a worker) that are legible and disputable.
- The content is written in English first. The interface strings are ready for translation; the content is not yet.

## 8. Disputing an entry

Open an issue with the "Dispute an entry" template (see `CONTRIBUTING.md`). Disputes about how a tradition is
described weigh most when they come from inside that tradition. Disputes about the reading are judged by the
mechanism: show who gains, who pays and how, and the entry changes.
