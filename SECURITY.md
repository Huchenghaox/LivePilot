# Security Policy

## Reporting Security Issues

Please do not open public issues with secrets, exploit details, private screenshots, phone numbers, user data, or model provider credentials.

Use GitHub's private vulnerability reporting flow for this repository when it is available:

1. Open the repository on GitHub.
2. Go to **Security**.
3. Choose **Report a vulnerability**.

If private vulnerability reporting is not visible, contact the repository owner privately through GitHub before sharing technical details. Do not post exploit details, production identifiers, screenshots, phone numbers, or credentials in a public issue.

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

## Production Operator Checklist

Before running a public deployment, operators should:

- configure `JWT_SECRET` and `MODEL_ENCRYPTION_KEY` as platform secrets;
- keep model provider keys server-side only;
- keep uploads in private storage;
- avoid logging uploaded screenshot contents, full model responses, Authorization headers, phone numbers, or API keys;
- rotate any secret that may have been pasted into chat, email, logs, or issue trackers.
