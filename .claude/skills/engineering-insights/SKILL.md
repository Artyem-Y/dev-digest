---
name: engineering-insights
description: Use during any DevDigest development, debugging, code review, testing, planning, or codebase explanation that concerns client, server, reviewer-core, or e2e, including routine sessions where the user does not explicitly ask for insights.
---

# Engineering Insights

## Core principle

Read relevant module knowledge before acting. Preserve only novel, evidence-backed lessons that will change how a future engineer works. An empty result is correct when nothing substantial was learned.

## Module map

| Work touches | Required log |
|---|---|
| `client/` | `client/INSIGHTS.md` |
| `server/` | `server/INSIGHTS.md` |
| `reviewer-core/` | `reviewer-core/INSIGHTS.md` |
| `e2e/` | `e2e/INSIGHTS.md` |

For a cross-module task, follow the workflow independently for every affected module.

## Workflow

### Before work

1. Infer affected modules from the request and the files that may change.
2. Read each module's `CLAUDE.md`, `README.md`, and entire `INSIGHTS.md` before the first implementation, diagnosis, review conclusion, or design decision.
3. Use existing insights as constraints. If the task expands into another module, read that module's files before continuing there.

Time pressure, a request to avoid documentation, or a seemingly small change does not remove the initial read. The read prevents repeated mistakes; it does not require writing an entry.

### During work

Keep candidate insights only when supported by concrete evidence such as code paths, tests, migration history, runtime behavior, or tool output. Do not interrupt implementation merely to record a candidate.

When deciding whether a candidate qualifies, read [references/insight-rubric.md](references/insight-rubric.md).

### Before the final response

1. Re-read the entire `INSIGHTS.md` for every affected module. Another worker may have appended since the initial read.
2. Compare candidates by meaning, not wording. Paths, names, or extra detail do not make an existing lesson novel.
3. Drop unsupported, obvious, temporary, sensitive, or duplicate candidates.
4. If nothing remains, do not change any insights file.
5. Append each remaining entry with the helper below, then re-read the appended entry and report the result accurately.

## Append-only write path

Never use Write, Edit, search-and-replace, or a patch operation on an existing `INSIGHTS.md`. Never delete, reorder, reformat, or "improve" an existing entry.

Run:

```sh
python3 "${CLAUDE_PROJECT_DIR}/.claude/skills/engineering-insights/scripts/append_insight.py" \
  --project-root "${CLAUDE_PROJECT_DIR}" \
  --module server \
  --category invariant \
  --title "Short reusable conclusion" \
  --evidence "Specific code, test, migration, or observed behavior" \
  --implication "What a future engineer should do differently" \
  --insight "Concise explanation of the mechanism and boundary"
```

Replace `--module` and `--category` with validated values. The helper accepts modules `client`, `server`, `reviewer-core`, and `e2e`; run `--help` for categories and arguments. It requires the target file to exist, locks it, blocks exact duplicate IDs, and opens it in append mode.

The agent remains responsible for semantic deduplication. A successful helper call does not prove the insight was worth recording.

## Corrections and supersession

Do not edit an inaccurate or obsolete entry. Append a new entry only when the correction changes future engineering behavior. Name the earlier stable ID in the new insight using `Supersedes <id>` and explain why.

If an existing insight is accurate and the candidate merely adds paths or wording, make no write.

## Cross-module discoveries

Append to each affected module only when future work in that module independently needs the lesson. Tailor evidence and implication to that module. Do not copy a module-specific entry into every log for visibility.

## Red flags

- "The user said to work quickly, so I can skip reading insights."
- "I can replace the old sentence with a clearer one."
- "Every completed task needs an insight entry."
- "A raw error message is useful enough without the cause."
- "The helper prevents all duplicates, so I do not need to re-read."
- "I can include a token, key, local secret path, or user data as evidence."

All of these mean stop and return to the workflow.
