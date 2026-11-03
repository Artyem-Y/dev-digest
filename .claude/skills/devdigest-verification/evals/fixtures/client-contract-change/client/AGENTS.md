# Client instructions

Use `src/lib/api.ts` as the HTTP boundary. Route components render UI and do
not call `fetch` directly. User-facing strings belong in `messages/en` and are
read through `next-intl`.
