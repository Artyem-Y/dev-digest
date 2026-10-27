---
name: dependencies-checker
description: Analyze a repository's Node dependencies and TypeScript import coupling when a developer needs package classifications, installed-size evidence, dependency graphs, or prioritized cleanup advice. Do not use for registry, license, or vulnerability scans.
---

# Dependencies checker

Use this skill for an evidence-backed dependency inventory of a local repository.

Run the bundled analyzer before making findings. It reads only local manifests,
`package-lock.json` files, `tsconfig.json` aliases, and source imports. It never
installs packages, changes dependency files, queries a registry, or guesses an
installed size.

```sh
sh .claude/skills/dependencies-checker/scripts/run-analyzer.sh \
  --root <repository-root> \
  --json <output-directory>/dependency-report.json \
  --markdown <output-directory>/dependency-report.md
```

The launcher selects an already-installed Node.js 16+ runtime; it never installs
one. Use the generated JSON as the source of truth and the Markdown report for the
developer-facing explanation. Say when a lockfile format or installed package
directory could not be measured; `unavailable` is evidence, not a zero-size
claim. Do not recommend upgrades, removal, or installation without a separate
request.

Read [references/report-contract.md](references/report-contract.md) before
interpreting priorities or adapting report output.

For a baseline-versus-skill comparison, use the isolated runner under `evals/`.
It makes model calls only when explicitly invoked with `--live`; that switch
must be authorized because it can incur usage cost.
Add `--judge` only with `--live` to run a separate, read-only structured
Markdown-quality judge after each generated report.
