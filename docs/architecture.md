# Architecture

The MCP server is a thin, farm-scoped adapter in front of the Ranch.Bot API. It advertises tools,
validates and adapts their input, authenticates the caller, and forwards reads and writes. The
backend owns authorization and persistence guarantees. The external MCP client owns human approval.

## Request path

```text
MCP client (assistant)
  │  stdio JSON-RPC                       self-hosted only: HTTPS + Bearer API key, POST /mcp
  ▼
src/index.ts        entrypoint: terminal login/logout, transport selection
  ▼
src/serverFactory.ts  tool list + call routing, farm resolution and the farm-required gate
  ▼
src/toolRegistry.ts → src/tools/*   per-tool input validation and response shaping
  ▼
src/client.ts       HTTP client, Authorization: Bearer <token>
  ▼
Ranch.Bot API       scopes, farm role (RBAC), validation, transactions, idempotency
  ▼
PostgreSQL          farms, animals, groups, records, birth events, tasks, protocols
```

The same `serverFactory` tool surface serves both transports. Only the credentials and default-farm
store differ: stdio keeps the device-flow session and an in-process farm selection; the self-hosted
HTTP path is stateless and resolves auth and the default farm per request.

## Who enforces what

| Layer                                              | Enforces                                                                                                                           | Does not enforce                          |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| MCP client (assistant)                             | Human review and explicit approval before a write; stopping on ambiguity                                                           | Server-side access control                |
| MCP server (`src/serverFactory.ts`, `src/tools/*`) | Tool schema validation, farm resolution, transport errors, farm-required gate                                                      | Farm roles, scopes, database transactions |
| Ranch.Bot API                                      | OAuth scopes, farm role, farm scoping, record attachment empty-input check and target filtering, birth transaction and idempotency | Assistant approval behavior               |
| OAuth device flow (`src/auth.ts`)                  | Terminal login, token refresh, revocation                                                                                          | Farm or record permissions                |

Because the API enforces authorization, a tool the caller cannot use fails at the API even if the
MCP server advertises it. The MCP server never broadens access: it forwards the caller's token.

## Guarantees in code

- **Farm scope.** Scoped tools receive a resolved `farm_id`; requests without one are rejected with
  an `InvalidRequest` MCP error before reaching the API. `list_my_farms`, `set_default_farm`,
  `get_current_context`, and the admin import tools are farm-exempt.
- **Authorization.** The API checks the OAuth scope and the caller's farm role. Readers can read,
  including `lookup_animal_by_eid`. Editors or Owners can run the applicable create and update
  operations and confirm a birth; deleting animals, groups, records, or identifiers needs Owner.
  Birth confirmation also needs `write:records`, `write:animals`, and `write:groups`. Required
  scopes are a separate condition from farm membership: a fresh login can add scopes, but it cannot
  raise a role, so an Editor denied a delete needs an Owner.
- **Record attachment (input check and target filtering).** The HTTP create endpoint rejects a
  request when both `animal_ids` and `group_ids` are omitted or empty, even though the tool schema
  marks both arrays optional. That is an input-length check, not a guarantee that a saved record has
  attachments. The service keeps only active animals and groups that belong to the selected farm and
  silently drops nonexistent, archived, soft-deleted, or other-farm UUIDs; this endpoint does not
  enable `requireAllAttachments`. A mixed valid/invalid list can save only a subset, and an entirely
  invalid list can create an orphan record that farm-scoped reads cannot retrieve. Preflight reads
  reduce the risk but do not remove it, because targets can change concurrently.
- **Birth events.** The API computes the preview and its confirmation hash, and the transactional
  save is idempotent for the exact approved tuple. The MCP adapter preserves the tuple; it does not
  decide the guarantee.
- **Revocation.** `logout` revokes the device session before clearing the cache. A revoked session
  stops working; requests already in flight are returned without automatic replay.

### What the confirmation hash proves

The confirmation hash binds a confirmation to a particular preview: the API recomputes it from the
reviewed input and evidence, and a changed or stale bundle does not match. It does **not** prove that
a human reviewed anything. Human review depends on the external client showing the full preview and
obtaining approval. Treat the hash as an integrity check, not an audit of intent.

## Results and errors

Tool results are a single MCP `text` content block. The server returns a plain string when a handler
returns one, otherwise the handler's result pretty-printed as JSON. The server does not declare
output schemas and does not put structured data in `structuredContent`; clients should treat the text
(or JSON) as the result and read the field back with a follow-up tool call when they need to confirm.

Failures are MCP errors (`McpError`) with a small set of codes:

- `InvalidRequest`: missing authentication, missing farm, or invalid arguments.
- `MethodNotFound`: an unknown tool name.
- `InternalError`: an authentication or handler failure.

The server does not promise a uniform pagination envelope or retry semantics. Pagination is per tool
(see [workflows](workflows.md#pagination)); retries are never automatic.

## Authentication and session state

The stdio transport uses Ranch.Bot's OAuth device flow. `ranchbot-mcp login` starts it in a terminal;
the producer approves the displayed URL and code in a browser. Tokens are cached locally under
`~/.ranchbot-mcp-tokens.json` with restricted permissions, bound to the API origin and OAuth client
ID. Reads and refreshes across running processes are serialized by an OS-managed lock
(`~/.ranchbot-mcp-tokens.lock`), so a replacement session is adopted without copying credentials.
Admin sessions use a separate `~/.ranchbot-mcp-admin-tokens.json` cache and
`~/.ranchbot-mcp-admin-tokens.lock`.

The self-hosted HTTP transport instead requires a `Bearer rb_sk_…` API key on every request. API keys
are deprecated and are not part of customer onboarding.

## Code map

| Path                             | Role                                                      |
| -------------------------------- | --------------------------------------------------------- |
| `src/index.ts`                   | Entrypoint, CLI subcommands, transport selection.         |
| `src/serverFactory.ts`           | Builds the MCP server, routes calls, resolves the farm.   |
| `src/toolRegistry.ts`            | Maps tool names to handler modules.                       |
| `src/tools/*`                    | Per-tool Zod schemas and response shaping.                |
| `src/generated/toolContracts.ts` | Generated tool metadata shared with the API/CLI contract. |
| `src/client.ts`                  | Typed HTTP client for the Ranch.Bot API.                  |
| `src/auth.ts`                    | OAuth device flow, refresh, and revocation.               |
| `src/tokenStorage.ts`            | Token cache, environment binding, and the native lock.    |
| `src/localSession.ts`            | Installation-local session file contract.                 |
| `src/serverInstructions.ts`      | Always-present safety guidance sent at initialization.    |

## Related

- [Workflows](workflows.md): the three supported workflows.
- [Development](development.md): local checks and authenticated development use.
- [Troubleshooting](troubleshooting.md): login, lock, access, and recovery.
