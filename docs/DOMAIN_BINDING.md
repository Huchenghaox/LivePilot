# Domain Binding

Target domain:

```text
livepilot.example.com
```

Recommended first production mapping:

- `livepilot.example.com` -> LivePilot frontend
- `api.livepilot.example.com` -> LivePilot FastAPI backend

## Before Binding

1. Verify containers are healthy on the server.
2. Verify Cloudflare Tunnel temporary access or local tunnel route.
3. Confirm backend CORS includes the exact frontend origin.
4. Confirm there is no old Tunnel or DNS route already using `livepilot.example.com`.

## Avoid Conflicts

Do not keep multiple active Cloudflare Tunnel public hostnames or DNS records pointing `livepilot.example.com` to different services. Remove or update old `www` routes before switching production traffic.

## Suggested Flow

1. Bind `api.livepilot.example.com` to the backend service.
2. Test:

```bash
curl https://api.livepilot.example.com/api/health
curl https://api.livepilot.example.com/api/ready
```

3. Set frontend `NEXT_PUBLIC_API_BASE_URL=https://api.livepilot.example.com` and rebuild frontend.
4. Bind `livepilot.example.com` to the frontend service.
5. Open `https://livepilot.example.com`.
6. Register, create streamer, create platform account, create preparation plan, create review, generate report.

## Root Domain

If `livepilot.example.com` is needed, redirect it to:

```text
https://livepilot.example.com
```

Do this only after `www` is verified.
