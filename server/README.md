# OpenCal sync server

Optional. OpenCal works fully on its own; run this server if you want your calendar on more than
one device. Each device keeps its own copy and exchanges changes with the server, the same way
[Immich](https://immich.app) keeps your photos on a server you host.

- Syncs calendars, events, stamps, birthdays, saved colors and color rules.
- Theme, notification defaults, hidden calendars and the floating-time default stay per device.
- When the same thing is changed on two devices before they sync, the later change wins.

## Run it

You need Docker. On the machine that will host it:

```bash
git clone https://github.com/BoazCohenJ/OpenCal.git
cd OpenCal/server
echo "OPENCAL_API_KEY=$(openssl rand -hex 24)" > .env
echo "TZ=Asia/Jerusalem" >> .env    # your time zone, for the agent tools
docker compose up -d --build
```

Data is kept in `server/data/`. Keep `.env` secret: the key is the only thing protecting your
calendar, and every device needs it.

Without Docker, with Node 24 or newer: `npm install`, then `OPENCAL_API_KEY=... npm start` (data
goes to `./data`, or set `DATA_DIR`; the port is 2290, or set `PORT`).

## Reach it from your phone

The Android app only connects over **HTTPS**. The simplest way is [Tailscale](https://tailscale.com)
on the server and the phone:

```bash
sudo tailscale serve --bg --https=2290 http://127.0.0.1:2290
```

The server is then at `https://<machine>.<tailnet>.ts.net:2290` from any device on your tailnet.
A reverse proxy with a certificate (Caddy, nginx, Traefik) works just as well.

Check it with `curl https://<your address>/api/health`.

## API

| Route | Auth | |
|---|---|---|
| `GET /api/health` | none | `{ ok, app: "opencal", version, serverId }` |
| `POST /api/sync` | `Authorization: Bearer <key>` | `{ serverId?, cursor, changes }` → `{ serverId, cursor, changes, accepted }` |
| `POST /mcp` | the key above, or `OPENCAL_AGENT_KEY` | Calendar tools for an AI agent (see below) |

`changes` is a `ChangeSet` ([src/models/Sync.ts](../src/models/Sync.ts)): records with the time
they last changed, and deletions. The server keeps the newer version of each record and returns
everything accepted after `cursor`. A client whose `serverId` doesn't match (a new or reset server)
gets everything and sends everything.

## Calendar tools for an AI agent (MCP)

`/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server, so an agent such as
Hermes, Claude or ChatGPT can read and change the calendar: forward it a message and it adds the
events, which reach your phone on its next sync.

- Tools: `list_calendars`, `find_events` (repeats expanded), `get_event`, `create_event`,
  `update_event`, `delete_event` (with "only this one" / "this and following" for repeating
  events, like the app), `recent_changes` and `undo`.
- `find_series_copies` and `fold_into_series` repair repeating events that an import broke apart
  (Google exports renamed occurrences as overrides, which arrive as one-off copies).
- Every change the tools make is logged with what it replaced, so it can be undone.
- Give the agent its own key: add `OPENCAL_AGENT_KEY=$(openssl rand -hex 24)` to `.env`. It only
  opens `/mcp`, not the sync API, and you can change it without touching your phones.
- Times are read and written in the server's time zone (`TZ` in `.env`).

For Hermes (`~/.hermes/config.yaml`):

```yaml
mcp_servers:
  opencal:
    url: "https://<your address>/mcp"
    headers:
      Authorization: "Bearer <OPENCAL_AGENT_KEY>"
```

## Development

The server runs its TypeScript directly on Node 24 (type stripping); storage is Node's built-in
`node:sqlite`. The agent tools reuse the app's own calendar code (`src/services/occurrences.ts`,
`eventTimes.ts`, `src/utils`), which `src/register.js` lets Node import, so the Docker image is
built from the repository root (`docker build -f server/Dockerfile .`).

```bash
cd server
npm install
npm run typecheck
OPENCAL_API_KEY=dev-key-0123456789 npm start
```
