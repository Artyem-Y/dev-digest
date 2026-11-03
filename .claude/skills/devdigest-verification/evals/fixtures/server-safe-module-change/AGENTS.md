# Fixture instructions

Server routes obtain workspace and user scope through
`src/modules/_shared/context.ts`. Routes validate and translate HTTP only;
new orchestration belongs in application code and dependencies are wired at the
composition boundary. Route tests use `app.inject()` and mocks.
