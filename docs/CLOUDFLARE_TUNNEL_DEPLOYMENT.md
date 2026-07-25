# Cloudflare Tunnel Deployment

Use Cloudflare Tunnel to expose the Huawei server after containers are healthy.

## Target Hostnames

- `livepilot.example.com` -> frontend on `http://127.0.0.1:3000`
- `api.livepilot.example.com` -> backend on `http://127.0.0.1:8000`

## Important

Do not keep conflicting DNS records or old Tunnel routes for the same hostname. Verify the Cloudflare temporary or internal route first, then move `livepilot.example.com`.

## Backend CORS

Set:

```bash
CORS_ORIGINS=https://livepilot.example.com
```

If testing from a temporary Cloudflare hostname, include that exact origin during testing.

## Verification

```bash
curl https://api.livepilot.example.com/api/health
curl https://api.livepilot.example.com/api/ready
```

Then open:

```text
https://livepilot.example.com
```

Check registration, login, model settings, streamer creation, platform account creation, preparation plan, review, and report generation.
