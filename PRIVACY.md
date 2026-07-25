# LivePilot Privacy

This document explains the intended privacy baseline for LivePilot open-source review and production operators. It is not final legal advice.

## Data Users May Provide

LivePilot may process:

- account registration information;
- username, nickname, phone number, and phone verification status;
- anchor profiles;
- manually recorded platform account information;
- live-stream planning inputs;
- backend screenshot uploads;
- manually entered live-stream metrics;
- review reports and feedback;
- model configuration metadata.

## Sensitive Data

Users should not upload passwords, cookies, private platform tokens, government IDs, medical records, or unrelated private personal information.

## AI Processing

When an administrator configures AI models, selected live-stream context may be sent to the configured model provider to extract screenshot metrics, generate plans, produce safety checks, and create reports. Operators should review the privacy terms of their chosen model provider before serving real users.

## Phone Verification

Phone numbers are used for registration verification, password recovery, and future account security flows such as changing the bound phone number. Phone numbers are not used as the daily login identifier. SMS verification codes are stored as hashes, expire quickly, and should never be shared with anyone.

## Storage

Local development stores data in the configured database and upload directory. Production deployments must configure secure storage, backups, access control, and deletion procedures.

## Deletion

Account deletion currently records a deletion request for administrator handling. Future releases should provide a more complete self-service deletion workflow.

## Support And Privacy Requests

Do not include private screenshots, phone numbers, model keys, platform account details, or other personal data in public GitHub issues.

For security issues, use the private reporting process described in `SECURITY.md`. For privacy or deletion requests in a deployed service, contact the operator of that specific deployment. This open-source repository does not automatically control third-party deployments.
