# Resource Limits

LivePilot should keep resource limits simple and visible. Limits protect the service from accidental abuse without adding a paid-plan system yet.

## Current Implemented Limits

- Screenshot upload size: `MAX_SCREENSHOT_UPLOAD_MB`.
- Media upload size: `MAX_MEDIA_UPLOAD_MB`.
- Screenshot file type checks.
- Model configuration timeout and retry bounds.
- SMS verification attempts and send limits.

## Recommended Near-Term Limits

These should be enforced by the backend and reflected in the frontend:

- Streamers per user.
- Platform accounts per user.
- Daily AI preparation plans per user.
- Daily report generations per user.
- Single upload batch count.
- Total storage per user.
- Rule count per user.
- Feedback content length.
- Long text input length for notes and prompts.

## Suggested Defaults for Private Beta

- Streamers per user: 20.
- Platform accounts per user: 20.
- Preparation generations per day: 30.
- Report generations per day: 20.
- Screenshot files per review: 20.
- Feedback content: 2,000 characters.
- Rule content: 5,000 characters.

## Production Notes

The current product does not implement billing tiers. If LivePilot becomes public, resource limits should be moved into a central policy module and later mapped to account plans.

