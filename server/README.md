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
docker compose up -d --build
```

Data is kept in `server/data/`. Keep `.env` secret: the key is the only thing protecting your
calendar, and every device needs it.

Without Docker, with Node 24 or newer: `OPENCAL_API_KEY=... npm start` (data goes to `./data`,
or set `DATA_DIR`; the port is 2290, or set `PORT`).

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

`changes` is a `ChangeSet` ([src/models/Sync.ts](../src/models/Sync.ts)): records with the time
they last changed, and deletions. The server keeps the newer version of each record and returns
everything accepted after `cursor`. A client whose `serverId` doesn't match (a new or reset server)
gets everything and sends everything.

## Development

The server runs its TypeScript directly on Node 24 (type stripping) and has no runtime
dependencies; storage is Node's built-in `node:sqlite`.

```bash
cd server
npm install        # only TypeScript and Node types, for the typecheck
npm run typecheck
OPENCAL_API_KEY=dev-key-0123456789 npm start
```
