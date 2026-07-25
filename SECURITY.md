# Security Policy

## Reporting Security Issues

Please do not open public issues with secrets, exploit details, private screenshots, phone numbers, user data, or model provider credentials.

Until a dedicated security address is published, report security concerns privately to the repository owner through GitHub.

## Supported Versions

Security fixes target the current `main` branch.

## Sensitive Data Rules

LivePilot must not commit:

- `.env`, `.env.local`, `.dev.vars`, or production environment files;
- API keys, model provider keys, JWT secrets, or encryption keys;
- platform access tokens, Cookies, or passwords;
- SQLite/D1 local databases;
- uploaded screenshots, audio, video, or private user files;
- real user data or private customer material.

## Platform Access Rules

LivePilot does not support:

- Douyin password login;
- Cookie import;
- private creator-center scraping;
- simulated login;
- reverse-engineered platform APIs;
- advice for bypassing moderation or platform safety systems.

Only official platform capabilities, user-provided screenshots, and manual data entry are allowed.

## Model Key Handling

Model provider keys must stay server-side. Admin-managed keys are encrypted before storage and are never returned to the browser in full.

## Disclosure Expectations

When reporting a vulnerability, include:

- affected component;
- steps to reproduce without exposing secrets;
- impact;
- suggested fix if available.
