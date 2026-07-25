# LivePilot Privacy

This document explains the intended privacy baseline for LivePilot Beta and open-source review. It is not final legal advice.

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

When users configure AI models, selected live-stream context may be sent to the configured model provider to generate plans, safety checks, and reports. Users should review the privacy terms of their chosen provider.

## Phone Verification

Phone numbers are used for registration verification, password recovery, and future account security flows such as changing the bound phone number. Phone numbers are not used as the daily login identifier. SMS verification codes are stored as hashes, expire quickly, and should never be shared with anyone.

## Storage

Local development stores data in the configured database and upload directory. Production deployments must configure secure storage, backups, access control, and deletion procedures.

## Deletion

Beta account deletion currently records a deletion request for administrator handling. Future releases should provide a more complete self-service deletion workflow.

## Contact

Project contact details are pending. Security or privacy issues should be reported privately rather than through public issues.
