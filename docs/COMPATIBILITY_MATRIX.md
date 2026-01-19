# Compatibility Matrix v0

## Runtime

- Node.js: 20.x, 22.x
- npm: 9+

## Required MOVA deps (enforced)

- @leryk1981/mova-spec = ^4.1.1
- @leryk1981/mova-core-engine = ^0.1.1

## Compatibility rules

- When updating mova-spec, run `npm run docs:bindings` and ensure `npm run quality` + `npm run quality:neg` are green.
- Deps gate: `npm run deps:audit` must pass.

## Exit codes

- 0: ok
- 2: validation/policy/bindings failures (strict deny, docs:check, deps:audit)

## Operational

- Deterministic outputs are guaranteed for identical inputs + flags.
