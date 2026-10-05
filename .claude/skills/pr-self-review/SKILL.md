---
name: pr-self-review
description: Manually review the current diff with every affected DevDigest package skill.
---

# PR self review

Manual-only workflow: never install a git-push hook.

1. Inspect `git diff -- client/ server/ reviewer-core/`.
2. When both client and server changed, apply both their architecture and test skills.
3. Check contracts in both vendored shared copies, migration direction, auth scope, and focused tests.
4. Report findings with file and line evidence; do not modify unrelated files.
