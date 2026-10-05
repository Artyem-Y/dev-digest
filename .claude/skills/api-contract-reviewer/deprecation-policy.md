# Deprecation policy

Prefer explicit deprecation with a replacement and removal date over silent removal of public behavior.

Good: mark `legacy_id` deprecated and document `id` as its replacement.

Bad: remove `legacy_id` from a live response with no notice.
