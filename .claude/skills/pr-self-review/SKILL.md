---
name: pr-self-review
description: Perform the final local DevDigest implementation diff check before handoff; this is not an independent architecture or security review.
---

# PR self review

Manual-only workflow for the plan-designated integration owner. Never install a
git-push hook. It is a focused self-check before handoff, not a replacement for
`architecture-reviewer`, `security-reviewer`, or `plan-verifier`.

1. Inspect the changed-file manifest and the final `git diff` for the affected
   packages only.
2. Apply only the skills selected by the approved plan; when client and server
   share a public contract, check both vendored copies.
3. Confirm focused-check receipts, integration-gate receipts, migration
   direction, and declared authorization scope where applicable.
4. Return concrete findings to the implementer with file and line evidence.
   Do not modify unrelated files or issue an independent approval.
