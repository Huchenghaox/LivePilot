# Dependency Security Review

Command used:

```bash
cd web
npm audit --json
```

Current result after controlled upgrades:

- 2 moderate severity findings.
- 0 low severity findings.
- 0 high or critical findings.

## Findings

### eslint

- Severity: low
- Direct dependency: yes, development dependency.
- Source: `@eslint/plugin-kit` Regular Expression Denial of Service advisory.
- Production impact: low. ESLint runs in development/CI, not in the browser application runtime.
- Action: upgraded to `eslint@9.39.4`.
- Current status: resolved.

### @eslint/plugin-kit

- Severity: low
- Direct dependency: no, transitive dependency through ESLint.
- Production impact: low. Development/CI tooling only.
- Action: resolved by upgrading ESLint within v9.
- Current status: resolved.

### postcss

- Severity: moderate
- Direct dependency: no after direct `postcss` was upgraded; remaining vulnerable copy is transitive under Next.js.
- Advisory: XSS via unescaped `</style>` in CSS stringify output.
- Production impact: needs review. LivePilot does not currently stringify untrusted user CSS, but PostCSS participates in build tooling.
- Action: upgraded direct `postcss` to `8.5.10`.
- Current status: still reported only through `next/node_modules/postcss`.

### next

- Severity: moderate because it depends on vulnerable PostCSS.
- Direct dependency: yes.
- Production impact: moderate until upstream Next.js releases or the project upgrades to a version that resolves the transitive issue.
- npm audit suggested fix: `next@9.3.3`, marked semver-major/downgrade-like and not appropriate for this app.

## Action Taken

- Upgraded `eslint` from `9.17.0` to `9.39.4`.
- Upgraded direct `postcss` from `8.4.49` to `8.5.10`.
- Did not run `npm audit fix --force`.

Reasons:

- `npm audit fix --force` would make unsafe major changes.
- The suggested Next.js version is not compatible with the current Next.js 16 app.
- Remaining issue is inside Next.js' dependency tree.

## Recommended Follow-Up

1. Monitor Next.js releases for a fix to the transitive PostCSS advisory.
2. Avoid accepting untrusted user-authored CSS input in the product.
3. Keep `npm audit` in the release checklist.
4. Do not force major dependency changes without regression testing.
