# PR Brief unavailable-source remediation

## Goal

Make an unavailable Intent or Blast Radius explicit in the PR Overview without
changing Brief generation, cache reuse, authorization, or model input.

## Behaviour

- The server continues to persist the generated Brief with its existing
  schema, including the safe empty values required by the cache contract.
- The persisted `sources` metadata remains the authority for whether Intent
  and Blast Radius were available at generation time.
- The client maps each unavailable source to its own localized unavailable
  state. It must not render an empty Intent quotation as though it were an
  available result, or present the Brief's fallback Blast object as real
  Blast Radius evidence.
- A generic source-status notice may remain, but cannot replace the specific
  Intent and Blast Radius messages.

## Safety and verification

- The change transports no new prompt, source content, secrets, filesystem
  paths, or provider data.
- Continue rendering model-derived strings with React text nodes; do not add
  HTML rendering or unvalidated links.
- Add client regressions for an unavailable Intent and Blast Radius and keep
  the existing cache/generation tests green.
