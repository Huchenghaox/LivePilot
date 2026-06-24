# Cloudflare Tunnel Deployment

Use Cloudflare Tunnel to expose the Huawei server after containers are healthy.

## Target Hostnames

- `www.haoxagent.com` -> frontend on `http://127.0.0.1:3000`
- `api.haoxagent.com` -> backend on `http://127.0.0.1:8000`

## Important

Do not keep conflicting DNS records or old Tunnel routes for the same hostname. Verify the Cloudflare temporary or internal route first, then move `www.haoxagent.com`.

## Backend CORS

Set:

```bash
CORS_ORIGINS=https://www.haoxagent.com
```

If testing from a temporary Cloudflare hostname, include that exact origin during testing.

## Verification

```bash
curl https://api.haoxagent.com/api/health
curl https://api.haoxagent.com/api/ready
```

Then open:

```text
https://www.haoxagent.com
```

Check registration, login, model settings, streamer creation, platform account creation, preparation plan, review, and report generation.
