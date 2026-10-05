# Engineering Insight Rubric

Read this file when evaluating a candidate insight. Record the candidate only when it passes all three gates.

## Three gates

1. **Non-obvious:** A competent engineer would not immediately derive it from the relevant README, file tree, public type, or ordinary command output.
2. **Evidence-backed:** The conclusion names concrete code paths, tests, migration history, runtime behavior, or reproducible tool output.
3. **Reusable:** Knowing it changes a future implementation, diagnosis, review, test, migration, or operational decision.

If any gate fails, make no write.

## Categories

| Category | Record when |
|---|---|
| `architecture` | A structural choice has a non-obvious reason or consequence. |
| `boundary` | Data or responsibility crosses modules in a surprising way. |
| `invariant` | Correctness depends on a condition that future changes could violate. |
| `debugging` | A recurring symptom has a verified root cause or discriminating check. |
| `testing` | A suite has a non-obvious prerequisite, isolation rule, or coverage limit. |
| `migration` | Schema history or rollout order constrains the safe change. |
| `security` | A trust boundary or exploit prevention rule is easy to bypass accidentally. |
| `performance` | Measured behavior reveals a reusable bottleneck or budget constraint. |
| `operations` | Runtime, deployment, or recovery behavior has a surprising prerequisite. |
| `decision` | A chosen tradeoff and its rejected alternative matter to later work. |

## Exclusions

Do not record:

- a list of files changed or tests run;
- README paraphrases or facts obvious from code names;
- task status, plans, deadlines, or temporary debugging state;
- unverified hypotheses or generic best practices;
- raw logs without mechanism and implication;
- secrets, credentials, tokens, connection strings, personal data, or sensitive payloads;
- an existing insight expressed with different wording;
- a routine success such as changing copy and seeing its focused test pass.

## Novelty examples

Qualifies:

- Migration history first created and later removed the same column, so restoring it requires a new forward migration rather than editing either historical file.
- A value is already aggregated in `reviewer-core` but is discarded at the server persistence boundary, so recomputing it from tokens would create two cost authorities.

Does not qualify:

- The client uses Next.js.
- Server tests use Vitest.
- A button label lives in an English message file.
- Shared contracts have two copies when the same lesson already exists in the module log.

## Entry quality

- **Title:** conclusion, not activity.
- **Evidence:** exact mechanism or observation, with paths or test names when useful.
- **Implication:** the future decision this changes.
- **Insight:** concise explanation of why the evidence implies the conclusion.

One strong entry is better than several fragments. Combine tightly coupled evidence into one lesson, but do not combine unrelated discoveries.
