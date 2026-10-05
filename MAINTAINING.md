# MCP maintainer guide

Start with the [customer quickstart](README.md). These are development, migration and operator procedures.

## Source development

Requires Node.js 22 or newer and an authorized Ranch.Bot development environment.

```bash
npm install
npm run build
npm test
```

Run the stdio entry directly from a local MCP client:

```text
node /absolute/path/to/mcp-server/dist/index.js
```

Set these environment variables for the development environment:

| Variable                   | Required state                           | Purpose                                 |
| -------------------------- | ---------------------------------------- | --------------------------------------- |
| `RANCHBOT_API_URL`         | Explicit development API URL             | Ranch.Bot API used by the source server |
| `COGNITO_DEVICE_CLIENT_ID` | Explicit public development OAuth client | Device-flow registration for that API   |
| `API_VERSION`              | Optional, defaults to `v1`               | API version                             |

The default is the stable public client `ranchbot-mcp`. Deploy its database migration before
using cloud authentication. A local API URL alone does not select installation-local accounts.

Development watch mode:

```bash
npm run dev
```

## Local client configuration

A source checkout can point an MCP client at the built file. Example shape:

```json
{
  "mcpServers": {
    "ranchbot-development": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"],
      "env": {
        "RANCHBOT_API_URL": "http://localhost:7001",
        "COGNITO_DEVICE_CLIENT_ID": "development-public-client-id"
      }
    }
  }
}
```

Use a real public OAuth client from the development environment. Never commit API keys, OAuth
tokens, or secret-bearing client registrations.

## Authentication

The stdio transport uses Ranch.Bot's OAuth device flow. Run `node dist/index.js login` in a
terminal before connecting your MCP client. Visit the displayed URL and explicitly approve browser
access. Tool calls without a session return terminal-login instructions and do not start login.
`node dist/index.js logout` revokes the session before clearing the cache; failed revocation retains
credentials for a retry. `--help` and `--version` work without authentication. No arguments starts stdio.

Ordinary login requests `read:farms`, read/write animals, groups and records, and `read:exports`.
Use `list_my_farms` then `set_default_farm`, or supply an explicit `farm_id`, before farm operations.
A replacement session for a different principal clears the in-process farm selection. Tokens are cached locally in `~/.ranchbot-mcp-tokens.json` with restricted file
permissions and refresh when the configured environment supports it.

The optional self-hosted HTTP transport uses bearer API-key auth for development compatibility. API
keys are deprecated and are not part of customer onboarding.

### Admin import sign-in

For internal concierge imports, add `--admin` to the stdio command (or to the local client's
`args` array):

```text
node /absolute/path/to/mcp-server/dist/index.js --admin
```

This selects the named `ranchbot-admin-cli` client and requests `admin:imports` alongside the
eight ordinary scopes. It overrides `COGNITO_DEVICE_CLIENT_ID`; explicitly setting that variable
to `ranchbot-admin-cli` also selects admin mode. The API must have that client registration, and
an admin account must approve the displayed device code in the browser.

Admin sessions use `~/.ranchbot-mcp-admin-tokens.json` and a separate persistent
`~/.ranchbot-mcp-admin-tokens.lock`. Ordinary sessions retain their existing cache and lock.
Run `node dist/index.js login --admin` before using admin mode;
admin refresh and sign-in do not replace the ordinary session.

The `list_pending_imports`, `get_import_request`, and `update_import_request_status` tools require
this admin session. Ordinary device sessions and the HTTP transport's API keys cannot use them.
The API checks both the import capability and current admin status on every request.

## Checks

```bash
npm run build
npm run typecheck
npm run lint
npm run prettier
npm test
```

Promote a new version only after current OAuth/scopes, npm and Registry read-back, and clean-machine
installation, authentication, farm scope, representative reads/writes, revocation, and upgrades
pass. The public CLI has independent setup guidance; local publication does not imply a hosted
ChatGPT/Gemini connection. Current status:
[ranch.bot/connect-your-ai](https://ranch.bot/connect-your-ai).

## Safe EID lookup and compatibility

`lookup_animal_by_eid` is read-only, accepts `eid` and optional `farm_id`, and requires Reader
access. It searches exact active EIDs on active animals across inventory statuses. A missing match
returns HTTP 404; multiple matching animals return HTTP 409. Neither case creates inventory.
`find_or_create_animal_by_eid` deliberately creates inventory on a miss and requires Editor access.

`find_animal_by_identifier` is deprecated and still **creates inventory** for compatibility.
Migrate reads to `lookup_animal_by_eid` and approved creation to `find_or_create_animal_by_eid`.
The deprecated alias remains through the current minor version; remove it only in a breaking release
with release notes. Both creation tools carry `readOnlyHint: false`.

Deploy the API's `/animals/lookup-by-eid` endpoint before releasing the new tool. An older API
causes lookup to fail; clients never fall back to find-or-create. This source change does not
establish npm, MCP Registry, or indexed-listing availability.

## Token-cache locking and upgrades

Token-cache reads and mutations use exclusive OS-managed locks (Node 22, pinned
`fs-native-extensions@1.5.0`). Lock files at `~/.ranchbot-mcp-tokens.lock` persist after logout
and process exit; their existence does not mean a client holds the lock. The OS releases
ownership when a client exits or crashes, allowing waiting clients to recover automatically.
Do not delete or replace a lock file while clients are running.

Each tool call checks the shared cache so running clients adopt replacement sessions.
Requests already using a revoked session may fail; failed requests are returned to the caller
without automatic replay.

Stop all older CLI/MCP processes before upgrading. Concurrent old/new lock protocols are
unsupported. A legacy file identifying a live process is rejected with an upgrade error;
an abandoned legacy file is reused in place. Acquisition errors fail closed, and contention
times out after 30 seconds.

Caches are bound to the API origin and OAuth client ID. A mismatch is rejected without overwriting
credentials. Stop older clients before upgrading. For a cache without this metadata, run logout with
its original `RANCHBOT_API_URL` and `COGNITO_DEVICE_CLIENT_ID`. Older provider credentials cannot be
revoked by the device-session endpoint: revoke them with the original provider before removing the
cache. A successful HTTP response alone does not establish legacy revocation.

Installation-local accounts retain the CLI-managed installation session: use
`ranchbot login --local --api-url <installation>` and set `RANCHBOT_DEPLOYMENT_MODE=local` plus the
same `RANCHBOT_API_URL` in the MCP client. MCP login/logout directs you to the CLI in that mode.
