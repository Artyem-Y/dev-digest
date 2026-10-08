# E2E Specifications

Start with the [e2e README](../README.md) for current behavior. Executable browser flows remain in this directory as `NN-name.flow.json`; this README is their human-facing index.

New flow specifications should state the user journey, seed-data assumptions, deterministic locators, expected assertions, and required failure artifacts. Never depend on an LLM call or the `agent-browser chat` command.

## Flow index

- `01-app-boot.flow.json` — app boot and initial redirect
- `02-repo-pulls-detail.flow.json` — PR list to PR detail
- `03-agents.flow.json` — seeded agent list
- `04-pr-findings.flow.json` — review findings
- `05-pr-diff.flow.json` — changed-file diff
- `06-onboarding.flow.json` — add-repository form
- `07-settings.flow.json` — settings sections
- `08-agent-run-cost.flow.json` — cost in PR list, run timeline, and trace
- `09-agent-enabled-toggle.flow.json` — toggle and restore a seeded agent's enabled state
