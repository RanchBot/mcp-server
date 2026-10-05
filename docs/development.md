# Development

Working on the MCP server itself. Two layers of checks: credential-free build and unit checks that
need no Ranch.Bot account, and an authenticated development server that talks to a real API. Releasing
and deploying are maintainer-owned and covered by the publishing procedure, not here.

For what the server does and how to install it as a user, see the [README](../README.md) and the
[public setup guide](https://ranch.bot/docs/mcp-setup).

## Credential-free checks

Requires Node.js 22 or newer and npm. From a source checkout:

```bash
npm ci
npm run build
npm run typecheck
npm run lint
npm run prettier
npm test
npm run test:release
npm run check:versions
```

- `npm ci` installs the pinned dependencies from `package-lock.json`.
- `build` compiles to `dist/` with `tsc -p tsconfig.build.json`.
- `typecheck` runs `tsc --noEmit`.
- `lint` and `prettier` check `src` and the whole package.
- `test` runs the Jest unit suite under `src/__tests__/unit`.
- `test:release` runs the Node test files in `scripts/release`.
- `check:versions` verifies `package.json`, both `package-lock.json` version fields, `server.json`,
  and any packaged README pins agree.

None of these need a Ranch.Bot account, an API URL, or a network call to Ranch.Bot.

### Focused test runs

Jest accepts a path or a name pattern:

```bash
npm test -- src/__tests__/unit/tools/birthEvents.test.ts
npm test -- src/__tests__/unit/stdioSession.test.ts
npm test -- src/__tests__/unit/tokenLock.test.ts
npm test -- src/__tests__/unit/tokenLockProcesses.test.ts
npm test -- src/__tests__/unit/serverFactory.test.ts
npm test -- --runInBand
```

Representative suites:

| Suite                                                                            | Covers                                                                                                    |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [`birthEvents.test.ts`](../src/__tests__/unit/tools/birthEvents.test.ts)         | Preview forwards the exact bundle without confirming; confirmation forwards the tuple; tool registration. |
| [`stdioSession.test.ts`](../src/__tests__/unit/stdioSession.test.ts)             | Two running processes sharing one token cache: refresh, replacement, and revocation transitions.          |
| [`tokenLock.test.ts`](../src/__tests__/unit/tokenLock.test.ts)                   | Lock release on failure, abandoned legacy files, live-owner rejection.                                    |
| [`tokenLockProcesses.test.ts`](../src/__tests__/unit/tokenLockProcesses.test.ts) | Real child processes exercising native-lock crash recovery.                                               |
| [`serverFactory.test.ts`](../src/__tests__/unit/serverFactory.test.ts)           | The locked tool surface, farm resolution, and per-call routing over an in-memory transport.               |
| [`animalLookupClient.test.ts`](../src/__tests__/unit/animalLookupClient.test.ts) | Read-only EID lookup makes zero write requests.                                                           |

### What the unit suite does and does not prove

The unit suite mocks the HTTP client and, for routing tests, wires the server to an in-memory MCP
transport. It demonstrates tool schemas, routing, farm resolution, response shaping, auth/refresh
transitions, and lock behavior. It does **not** prove production API authorization, cross-farm
denial, transactional birth atomicity, or release acceptance. Those require a real backend and the
maintainer-run acceptance procedure. The birth tests assert the adapter forwards the exact preview
tuple and that a preview does not confirm; they do not prove the backend transaction.

`tokenLockProcesses.test.ts` runs real child processes and the pinned native lock
(`fs-native-extensions`), so it exercises the host OS rather than a mock. CI runs the native lock
and session tests on Linux, macOS, and Windows.

## Authenticated development server

A development server needs a Ranch.Bot development environment. Build first, then run the stdio
entry directly or in watch mode:

```bash
npm run build
node dist/index.js login        # terminal device-flow login
node dist/index.js              # start stdio
# or, for iterative work:
npm run dev                     # tsx watch on src/index.ts
```

Set these environment variables for a development API. The default is the public
`ranchbot-mcp` client.

| Variable                   | Default                                                            | Purpose                                           |
| -------------------------- | ------------------------------------------------------------------ | ------------------------------------------------- |
| `RANCHBOT_API_URL`         | `https://api.ranch.bot` (or `http://localhost:8080` in local mode) | API the server calls.                             |
| `COGNITO_DEVICE_CLIENT_ID` | `ranchbot-mcp`                                                     | Public OAuth device client.                       |
| `API_VERSION`              | `v1`                                                               | API version segment.                              |
| `RANCHBOT_DEPLOYMENT_MODE` | unset                                                              | Set to `local` for an installation-local account. |
| `MCP_TRANSPORT`            | `stdio`                                                            | Set to `http` for the self-hosted HTTP transport. |
| `PORT`                     | `3000`                                                             | Port for the HTTP transport.                      |

Point a development MCP client at the built file:

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

The source server has no hosted endpoint of its own. A development API URL alone does not select
installation-local accounts.

### Installation-local accounts

Installation-local deployments keep the CLI-managed installation session. Sign in from the terminal
with the CLI, then point the MCP client at the same origin:

```bash
ranchbot login --local --api-url <installation>
```

Set `RANCHBOT_DEPLOYMENT_MODE=local` and the same `RANCHBOT_API_URL` in the MCP client. In that
mode, MCP `login`/`logout` direct you to the CLI. MCP reads the session file at
`~/.ranchbot/local/<sha256-of-origin>.json`; credentials never enter tool arguments.

### Admin import sessions

Admin imports use a separate OAuth client and token cache. Add `--admin` to the stdio command (or to
the client's `args`):

```text
node /absolute/path/to/mcp-server/dist/index.js --admin
```

This selects `ranchbot-admin-cli` and requests `admin:imports` alongside the ordinary scopes. Run
`node dist/index.js login --admin` first. The API must have that client registration, and an admin
account must approve the device code. Admin sessions use `~/.ranchbot-mcp-admin-tokens.json` and a
separate lock; ordinary sessions are unaffected. `list_pending_imports`, `get_import_request`, and
`update_import_request_status` require this session.

### Self-hosted HTTP transport

Set `MCP_TRANSPORT=http` to run the stateless Streamable HTTP transport. It listens for JSON-RPC on
`POST /mcp`, serves `GET /status`, and authenticates every request with a
`Bearer rb_sk_…` API key. API keys are deprecated and intended only for directed development
compatibility, not customer onboarding. Deploy it behind TLS.

## Packaging, release, and deployment

Packaging, publication to npm and the MCP Registry, and production migration are maintainer-only
steps with their own gates and evidence. Do not treat a green local suite or a candidate version in
`package.json` as proof that a release is published or deployed.

## Related

- [Workflows](workflows.md): the three supported farm workflows.
- [Architecture](architecture.md): enforcement boundaries and the request path.
- [Troubleshooting](troubleshooting.md): login, lock, and access problems.
