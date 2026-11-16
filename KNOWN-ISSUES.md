# Known issues from blind runs

Blind respondents take a Survey through `standpoint blind` from a one-paragraph brief, seeing only what a
person sees. Their logs are in `packages/core/test/blind/runs/`, and `packages/core/test/blind/score.ts` compares
each log with the suite persona of the same id. Every mismatch is one of three kinds: wrong evidence mapping
(fix the content), option wording a real holder would not choose (fix the wording), or a missing option (add
it). Each entry says which, and whether it is fixed.

## Pilot (8 personas, one run each, seed 1)

| persona | decisions | keystones | own tradition rank | neighbor rank |
|---|---|---|---|---|
| ml | 46 | 4/4 | 1 | |
| anarcho-syndicalist | 46 | 3/3 | 1 | council-communism 7 |
| council-communist | 46 | 2/3 | 5 | anarchism.syndicalist 1 |
| liberal-technocrat | 45 | 1/2 | 3 | ordoliberal 7 |
| ordoliberal | 45 | 1/2 | 7 | technocratic 4 |
| national-conservative | 48 | 1/3 | 2 | |
| cs-own-first | 48 | 0/2 | 10 | |
| cs-rigged-cabbie | 45 | 0/2 | 8 | |

No respondent held a position its persona's `never` list forbids.

### Fixed

- **Pensions counted as dependence on benefits** (engine). "Pensions, benefits or other transfers" was one
  income option, so a retired central-bank economist was placed in the reserve army. Pensions are now their
  own option, and a pension keeps the class of the work it came from (older logs: transfers + retired).
- **Labels cut at the first comma** (content). In flow-style YAML an unquoted comma ends the value, so the
  Situation form showed "Pensions", "Interest", "Gig", "Farming", "I manage people" and 16 other truncated
  labels, and 20 source authors and titles were cut. All 41 quoted; compile now fails on any key left without
  a value.
- **"Backs your class against capital" when capital gains too** (engine). A professional program that also
  advantages finance and industry now reads "alongside capital".
- **"Your anger points up and part of your program points down"** fired on "Refuse to vote on principle",
  which charges core workers too. A downward position now charges only the bottom.
- **"You carry a landlord's program"** fired for a renting care worker on "keep my head down" and "our people
  first". The claim now needs positions about land, housing or property.
- **Settler tension asked of an indigenous respondent** (content). `tension.conquest-closed-door` now excludes
  respondents who answered "indigenous".
- **Debt was single-choice** (content). A mortgage and car finance could not both be given.

### Open (for the full batch)

- **Missing options (council communist, anarcho-syndicalist):** scenes on hospitals, ports, hill land, wage
  councils and the Dhaka–Hamburg chain offer the state, a council, a cooperative or a union as decider, and no
  option for the workers and neighbors deciding in their own assemblies. Scenes that ask the respondent to
  choose between national capitals (Abadan 1951, the railway, "How far loose", "The word") have no option
  refusing the choice. This is the likely cause of the council-communist/syndicalist neighbor failure.
- **Missing options (ordoliberal, liberal technocrat):** no option for competition law and antitrust ("The
  merger", "The draft", "The app", "The cane is in"), and none for "it works, with enforcement and
  compensation" or "growth plus state capacity". This is the likely cause of the ordoliberal ranking below
  the technocrat.
- **Missing options (Marxist-Leninist):** no "monopolies and the imperialist hierarchy" answer in "Why can the
  brands squeeze that hard", and no "collective struggle led by union and party" in "The letter".
- **History probes shown to people who do not know the history** (selection). The cabbie got Bad Godesberg 1959,
  Paris 1983 and Athens 2015, and the care worker got the end of apartheid, with no "I don't know this" answer.
  Decline exists but does not read as that. Needs either a "don't know this" affordance or a lower weight for
  history probes when the respondent's answers are common-sense.
- **Common-sense personas are not recovered** (0/2 keystones each, own tradition ranked 8 and 10). Partly the
  history-probe problem above, partly few defining positions for common-sense traditions.
- **Role answers read as the respondent's own view.** In "Nine Floors" the council communist played a landlord,
  answered as a tenant-sympathizing one, and the result said she "accepts private ownership". Design question:
  arc roles are meant to record what the respondent would do in that position, but the reading should not
  report a role choice as a holding without saying so.
- **Situation gaps:** no warehouse/logistics wording for pickers (Transport was nearest), no middle option for
  EU semi-periphery countries like Poland in "Where do you live in the world economy?", employment
  single-choice when someone is both gig and own-account, no "not voting is not an option" (compulsory voting)
  in the ballot scene.
- **Readings that need a second look:** the ordoliberal (finance sector, no authority) is placed among core
  workers and gets "you live by your labor and broke toward property and order"; the Survey ran to 48
  decisions for two respondents while promising "about 45".
