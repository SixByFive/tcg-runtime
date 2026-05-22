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

Use **Docker Container** monitor type — reads health state directly from the Docker socket, no network access needed. Stays fully independent of the backend stack.

First, set up the Docker host in **Settings → Docker Hosts**:
- **Name**: Local
- **Connection Type**: Socket
- **Socket Path**: `/var/run/docker.sock`

Then add a monitor for each container (type: Docker Container, Docker Host: Local):

| Friendly Name | Container Name |
|---------------|----------------|
| Gateway | `Gateway` |
| Auth | `Auth` |
| Catalog | `Catalog` |
| Collections | `Collections` |
| Notifications | `Notifications` |
| Messaging | `Messaging` |
| Realtime | `Realtime` |
| Marketplace | `Marketplace` |
| Trading | `Trading` |
| Payments | `Payments` |
| Worker | `Worker` |
| Media | `Media` |

Container names match those shown in `docker ps`.

## Alerts

Configure a Discord webhook or email in **Settings → Notifications** before adding monitors, then attach it to each monitor.

## Updates

```bash
cd infra/monitoring
docker compose pull && docker compose up -d
```
