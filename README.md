# Ranch.Bot MCP Server

Work with cattle and sheep records from a local stdio MCP client. Requires Node.js 22 or newer,
a Ranch.Bot account and access to a farm. Ranch.Bot does not operate a hosted MCP endpoint.

## Release availability

Check [the release and setup page](https://ranch.bot/connect-your-ai) for verified public versions.
A source checkout or candidate is not evidence that a version is available on npm or in the Registry.
The public CLI has separate [setup instructions](https://ranch.bot/docs/cli-setup).
For everyday records, use [SMS and web setup](https://ranch.bot/docs/getting-started).

## Terminal commands

With the installed `ranchbot-mcp` command, run `ranchbot-mcp login` in a terminal and approve the
URL and code in your browser. Configure your local MCP client to run `ranchbot-mcp` with no arguments.
Use an absolute executable path if the client does not inherit your terminal PATH.
`ranchbot-mcp --help` and `ranchbot-mcp --version` require no authentication.
Run `ranchbot-mcp logout` to revoke the session before removing its local credentials.

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

| Variable | Required state | Purpose |
| --- | --- | --- |
| `RANCHBOT_API_URL` | Explicit development API URL | Ranch.Bot API used by the source server |
| `COGNITO_DEVICE_CLIENT_ID` | Explicit public development OAuth client | Device-flow registration for that API |
| `API_VERSION` | Optional, defaults to `v1` | API version |

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

## Tool surface

The source server exposes farm-scoped tools for:

- farms and current farm context;
- animals and identifiers;
- groups;
- health, movement, feed, genetic, and other records;
- atomic birth events, linked follow-up tasks, and immutable farm protocol versions; and
- read-only Farm Memory.

External MCP writes execute through the MCP client's granted access. They do not use the Ranch.Bot
app's review-before-saving screen. Ordinary CRUD tools call the farm endpoints and do not create the
Action rows that back Change History today. The source guarantees to preserve are farm scope and
revocation.

`preview_birth_event` returns the complete birth bundle, resolved evidence, and a confirmation hash
without saving farm data. Show every field to the producer and obtain explicit approval before
`confirm_birth_event`, preserving the exact `request_id`, `bundle`, and `confirmation_hash`.
Corrections or changed evidence require a fresh preview and renewed approval. Confirmation requires
EDITOR access and `write:records`, `write:animals`, and `write:groups` scopes.
`list_birth_events` and `get_birth_event` retrieve saved events; `list_farm_tasks` includes undated
TODOs, and `update_farm_task` changes status or the optional due date. `list_protocol_versions` and
`create_protocol_version` use producer-provided immutable steps without inventing care instructions.

`get_birth_source_evidence` reads the source author's retained SMS media status and current-farm
identity candidates. It requires `read:records`, `read:animals`, and current farm access. Partial or
ambiguous matches require producer selection before birth confirmation.

## Checks

```bash
npm run build
npm run typecheck
npm run lint
npm run prettier
npm test
```

Public setup returns only after current OAuth/scopes, npm and Registry read-back, and clean-machine
installation, authentication, farm scope, representative reads/writes, revocation, and upgrades
pass. CLI 1.0.0 is already public and has independent setup guidance; local publication does not imply a hosted
ChatGPT/Gemini connection. Current status:
[ranch.bot/connect-your-ai](https://ranch.bot/connect-your-ai).

## License

MIT

### Token-cache locking and upgrades

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
