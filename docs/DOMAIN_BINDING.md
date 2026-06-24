# Domain Binding

Target domain:

```text
www.haoxagent.com
```

Recommended first production mapping:

- `www.haoxagent.com` -> LivePilot frontend
- `api.haoxagent.com` -> LivePilot FastAPI backend

## Before Binding

1. Verify containers are healthy on the server.
2. Verify Cloudflare Tunnel temporary access or local tunnel route.
3. Confirm backend CORS includes the exact frontend origin.
4. Confirm there is no old Tunnel or DNS route already using `www.haoxagent.com`.

## Avoid Conflicts

Do not keep multiple active Cloudflare Tunnel public hostnames or DNS records pointing `www.haoxagent.com` to different services. Remove or update old `www` routes before switching production traffic.

## Suggested Flow

1. Bind `api.haoxagent.com` to the backend service.
2. Test:

```bash
curl https://api.haoxagent.com/api/health
curl https://api.haoxagent.com/api/ready
```

3. Set frontend `NEXT_PUBLIC_API_BASE_URL=https://api.haoxagent.com` and rebuild frontend.
4. Bind `www.haoxagent.com` to the frontend service.
5. Open `https://www.haoxagent.com`.
6. Register, create streamer, create platform account, create preparation plan, create review, generate report.

## Root Domain

If `haoxagent.com` is needed, redirect it to:

```text
https://www.haoxagent.com
```

Do this only after `www` is verified.
