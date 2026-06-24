# Dependency Security Review

Command used:

```bash
cd web
npm audit --json
```

Result:

- 2 low severity findings.
- 2 moderate severity findings.
- 0 high or critical findings.

## Findings

### eslint

- Severity: low
- Direct dependency: yes, development dependency.
- Source: `@eslint/plugin-kit` Regular Expression Denial of Service advisory.
- Production impact: low. ESLint runs in development/CI, not in the browser application runtime.
- Available non-breaking path: npm reports `eslint@9.39.4` as a non-major upgrade.

### @eslint/plugin-kit

- Severity: low
- Direct dependency: no, transitive dependency through ESLint.
- Production impact: low. Development/CI tooling only.
- Available non-breaking path: upgrade ESLint within v9.

### postcss

- Severity: moderate
- Direct dependency: yes in dev dependencies, and also transitive under Next.js.
- Advisory: XSS via unescaped `</style>` in CSS stringify output.
- Production impact: needs review. LivePilot does not currently stringify untrusted user CSS, but PostCSS participates in build tooling.
- Safe upgrade path: direct `postcss` can likely be upgraded within v8, but the audit also reports a vulnerable copy under Next.js.

### next

- Severity: moderate because it depends on vulnerable PostCSS.
- Direct dependency: yes.
- Production impact: moderate until upstream Next.js releases or the project upgrades to a version that resolves the transitive issue.
- npm audit suggested fix: `next@9.3.3`, marked semver-major/downgrade-like and not appropriate for this app.

## Action Taken

No automatic fix was applied.

Reasons:

- `npm audit fix --force` would make unsafe major changes.
- The suggested Next.js version is not compatible with the current Next.js 16 app.
- The low severity ESLint issue is development-only and can be handled in a normal dependency update.

## Recommended Follow-Up

1. Try a controlled ESLint v9 patch upgrade in a separate dependency PR.
2. Monitor Next.js releases for a fix to the transitive PostCSS advisory.
3. Consider overriding direct `postcss` to a patched v8 release only after verifying compatibility with Next.js and Tailwind.
4. Keep `npm audit` in the release checklist, but do not force major dependency changes without regression testing.

