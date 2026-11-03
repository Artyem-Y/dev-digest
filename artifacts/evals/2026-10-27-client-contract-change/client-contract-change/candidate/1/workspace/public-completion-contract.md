# Workflow completion contract

For an evaluation task, make the requested source changes and write
`result/completion.json` at the fixture root. It is an object with:

- `changed_paths`: repository-relative paths changed for the task;
- `verification`: receipts with `command`, `status` (`passed`, `failed`, or
  `blocked`), and a concise `scope`;
- `environment_blocks`: an optional array of tools or services that prevented a
  requested check.

Do not claim a check passed unless it was run. A blocked check is valid only
when its required environment is unavailable.
