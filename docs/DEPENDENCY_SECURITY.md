# Dependency Security Review

Last reviewed during the open-source repository cleanup.

## Commands

```bash
cd workers/api
npm audit --omit=dev --json
```

```bash
cd web
npm audit --omit=dev --json
```

## Worker API

Production dependency audit result:

- 0 low
- 0 moderate
- 0 high
- 0 critical

## Web

Current production dependency audit result:

- 0 low
- 0 moderate
- 3 high
- 0 critical

The reported items are under the Next.js dependency tree:

- `next`
- transitive `postcss`
- transitive `sharp`

## Action Taken

- Upgraded `next` from `16.2.9` to `16.2.11`.
- Upgraded `eslint-config-next` from `16.2.9` to `16.2.11`.
- Re-ran typecheck, lint, standard build, and OpenNext Cloudflare build successfully.
- Did not run `npm audit fix --force`.

## Current Assessment

`npm audit` still reports advisories for the current Next.js line and suggests an incompatible downgrade/major-path fix. Forcing that change would be riskier than tracking the upstream fix.

The app should continue to:

- avoid accepting untrusted user-authored CSS;
- avoid exposing image processing inputs outside the existing product upload flow;
- monitor Next.js releases;
- upgrade Next.js again once a compatible advisory-clearing release is available.

## Follow-Up

1. Re-run `npm audit --omit=dev` before each production release.
2. Watch Next.js security releases.
3. Do not force dependency changes without full regression testing.
