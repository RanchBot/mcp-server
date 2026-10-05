# Troubleshooting

Common problems when installing or running the MCP server, and how to recover without losing
credentials or duplicating writes. For setup steps, see the [README](../README.md) and the
[public setup guide](https://ranch.bot/docs/mcp-setup).

## `ranchbot-mcp: command not found`, or the client cannot find it

The package installs a `ranchbot-mcp` command. In a terminal, confirm it is on `PATH`:

```bash
which ranchbot-mcp      # macOS/Linux
ranchbot-mcp --version  # prints the installed version, without authentication
```

PID and PATH differences are the usual cause: MCP clients often start without the shell profile
that added the npm global `bin` directory. Use the absolute path to the executable in the client's
`command`, or start the built entry directly with `node /absolute/path/to/dist/index.js`. If you
installed into a different Node version or nvm prefix, `ranchbot-mcp` may not be the one the client
uses.

## Terminal login does not finish

`ranchbot-mcp login` prints a URL and a code. Open the URL and explicitly approve the requested
access. Login does not start automatically from a tool call: a call without a session returns
terminal-login instructions instead. If the approval window expires, run `ranchbot-mcp login`
again. Keep passwords and token files out of assistant messages.

`ranchbot-mcp --help` and `ranchbot-mcp --version` never require authentication.

## Farm selection errors

A scoped call without a farm returns `Farm ID is required. Use list_my_farms to see available farms,
or set_default_farm to set a default.` Resolve it by calling `list_my_farms`, then either pass an
explicit `farm_id` on the call or ask the producer which farm to use and call `set_default_farm`. Do
not guess when more than one farm is plausible.

A replacement session for a different principal clears the process's saved farm selection, so expect
to select again after switching accounts.

## Denied access

The API checks both the OAuth scope and the caller's farm role, so an operation can fail even though
the MCP server advertised it.

- **Reader role:** reads and `lookup_animal_by_eid` work.
- **Editor or Owner role:** the applicable create and update operations and birth confirmation
  work. Birth confirmation also needs the `write:records`, `write:animals`, and `write:groups`
  scopes.
- **Owner role:** deleting animals, groups, records, or identifiers works. An Editor who needs a
  delete must ask a farm Owner; repeated logins do not raise a farm role.
- **Missing scope:** a session created with limited scopes cannot perform writes in another scope
  group. Re-run `ranchbot-mcp login` and approve the full requested access. This addresses a missing
  session scope only; it cannot upgrade farm membership.
- **Admin tools:** `list_pending_imports`, `get_import_request`, and
  `update_import_request_status` require an admin session (`--admin`) and `admin:imports`. An
  ordinary session gets an authorization error from the API.

A tool that returns not-found or an ambiguity error for `lookup_animal_by_eid` is not an access
problem: no match is a normal result, and multiple matches require the producer to choose. Neither
creates inventory.

## A write is uncertain or timed out

If a create, update, delete, or birth confirmation times out or its result is unclear, **stop and
reconcile with reads before doing anything else**. Read the record or event back and compare it with
what you intended. Never automatically replay a mutation. An unchanged retry of an approved birth
tuple returns the already-saved event rather than duplicating it, but any other uncertain write
should be confirmed by reading first.

A saved birth cannot be corrected through the tools. Refer the producer to
[support](https://ranch.bot/support) and do not promise an amendment.

## Logout failures

`ranchbot-mcp logout` revokes the device session before clearing the cache. If revocation fails, the
credentials remain so you can retry; the command reports the reason. Common cases:

- **Missing refresh token:** `Cannot revoke this cache: refresh token missing. Credentials were
retained.` Restore the cache before retrying; there is nothing to revoke.
- **Legacy credentials:** provider credentials created before device sessions cannot be revoked
  through the device-session endpoint. Revoke them with the original provider, then remove the cache.
- **Client cannot confirm legacy cache:** run logout with the original `RANCHBOT_API_URL` and
  `COGNITO_DEVICE_CLIENT_ID`.

Do not delete a cache to "force" logout; a retained cache is a safety property, not a bug.

## Session replacement

Running clients share one token cache. Each call checks the cache, so a client adopts a replacement
session automatically; a request already using a revoked session may fail and is returned without
automatic replay. If a tool call fails after a login in another terminal, retry the read once the
replacement is in place. The farm selection resets when the principal changes.

## Environment-bound caches

The cache is bound to the API origin and OAuth client ID. Pointing the server at a different
environment or client without updating the cache fails closed with a message such as `Token cache
belongs to another API origin or client. Use its original settings to log out first. Credentials
were retained.` Do not copy credentials between environments; log out under the original settings
and sign in again. A cache missing this metadata is a legacy cache: stop older clients, then run
logout with its original `RANCHBOT_API_URL` and `COGNITO_DEVICE_CLIENT_ID`.

## Lock contention and safe upgrades

Token-cache reads and mutations use an exclusive OS-managed lock (Node 22, pinned
`fs-native-extensions`). Lock files persist after logout and process exit; their existence does not
mean a client holds the lock. The OS releases ownership when a client exits or crashes, so waiting
clients recover automatically.

- **Contention:** acquisition times out after 30 seconds. If it keeps timing out, find and stop older
  `ranchbot-mcp` processes.
- **Do not delete or replace an active lock file.** Unlinking it lets contenders lock different
  inodes and defeats the lock.
- **Legacy PID locks:** a legacy file naming a live process is rejected with an upgrade error. Stop
  the older client; an abandoned legacy file is reused in place.
- **Upgrades:** stop all older CLI/MCP processes before upgrading. Concurrent old/new lock protocols
  are unsupported. A cached session from an older release may need a fresh `ranchbot-mcp login`.

## Where to get help

For setup, access, or data questions, contact [support@ranch.bot](mailto:support@ranch.bot). Include
what you ran, the error text, and the package version from `ranchbot-mcp --version`. Do not send
tokens, credentials, or customer records.

## Related

- [Workflows](workflows.md): safe read and write procedures.
- [Architecture](architecture.md): where authorization and guarantees live.
- [Development](development.md): local checks and development setup.
