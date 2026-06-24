# Security Policy

## Reporting Security Issues

Do not open a public issue with secrets, tokens, private screenshots, user data, or exploit details.

Until a dedicated security contact is published, report security concerns privately to the repository owner.

## Sensitive Data Rules

LivePilot must not commit:

- `.env` or `.env.local`;
- API keys;
- model provider keys;
- platform access tokens;
- passwords;
- SQLite databases;
- uploaded screenshots;
- audio/video files;
- real user data.

## Platform Access Rules

LivePilot does not support:

- Douyin password login;
- Cookie import;
- private creator-center scraping;
- simulated login;
- reverse-engineered app APIs.

Only official OAuth and user-provided screenshots/manual data are allowed.

## Supported Versions

The project is in Beta. Security fixes should target the current main branch.

