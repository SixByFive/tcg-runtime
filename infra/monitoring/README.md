# SBF TCG — Monitoring

Uptime Kuma running independently from the main backend stack. Kept separate so it stays alive during backend deploys, restarts, or failures.

## Start

```bash
cd infra/monitoring
docker compose up -d
```

## Access

Web UI: `http://<your-server>:3001`

First boot prompts you to create an admin account.

## Recommended monitors

Add these in the UI (type: HTTP(s), interval: 60s):

| Name | URL |
|------|-----|
| Gateway | `http://localhost:4010/health` |
| Auth | `http://localhost:4011/health` |
| Collections | `http://localhost:4013/health` |
| Catalog | `http://localhost:4012/health` |
| Notifications | `http://localhost:4016/health` |
| Messaging | `http://localhost:4022/health` |
| Realtime | `http://localhost:4018/health` |
| Marketplace | `http://localhost:4014/health` |
| Trading | `http://localhost:4015/health` |
| Payments | `http://localhost:4019/health` |
| Worker | `http://localhost:4020/health` |
| Media | `http://localhost:4017/health` |

Use `localhost` since Uptime Kuma is on the same server — no need to go through the public domain.

## Alerts

Configure a Discord webhook or email in **Settings → Notifications** before adding monitors, then attach it to each monitor.

## Updates

```bash
cd infra/monitoring
docker compose pull && docker compose up -d
```
