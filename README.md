# Ranch.Bot MCP Server

Work with cattle and sheep records from a local stdio MCP client. The server exposes one farm's
livestock records at a time to an external assistant. You need Node.js 22 or newer, a Ranch.Bot
account and access to a farm. Ranch.Bot does not operate a hosted MCP endpoint.

## Requirements

- **Node.js 22 or newer.**
- A Ranch.Bot account with access to at least one farm.
- A local MCP client that can launch a stdio server. The configuration below is generic stdio; this
  README does not claim compatibility with any particular assistant.

## Install and sign in

Use the pinned install command on the public setup page. It is the source of truth for the verified
release: <https://ranch.bot/docs/mcp-setup>. The commands below describe this package version; a
source candidate is not a published release. Stop older CLI and MCP processes before upgrading;
never remove their active lock files.

Then sign in from a terminal:

```bash
npm install -g @ranchbot/mcp-server@0.1.3
ranchbot-mcp --version
ranchbot-mcp login
```

Open the URL printed in the terminal, sign in, and explicitly approve the displayed code and
requested access. No API key is needed. If login expires, run `ranchbot-mcp login` again. Keep
passwords and token files out of assistant messages.

Point your MCP client at the installed command with no arguments:

```json
{
  "mcpServers": {
    "ranchbot": { "command": "ranchbot-mcp", "args": [] }
  }
}
```

If the client does not inherit your terminal `PATH`, use the absolute path to `ranchbot-mcp`.
Restart the client after changing configuration. `ranchbot-mcp --help` and `ranchbot-mcp --version`
work without authentication. This generic configuration makes no individual client compatibility
promise.

## First successful read

Ask your assistant to run these three reads in order:

1. `list_my_farms` with `{}`: returns the farms the account can access. Note the ID of the farm you
   want.
2. `set_default_farm` with `{"farm_id":"<farm_id>"}`: saves the working farm for later calls. You
   can also pass an explicit `farm_id` on any scoped call instead.
3. `list_animals` with `{}`: returns the selected farm's current animals. An empty list is a
   successful read.

If more than one farm is plausible and the producer did not name one, ask instead of guessing. If a
call reports that a farm is required, repeat `list_my_farms` and select a farm. If access is denied,
check the account and farm membership; missing authentication requires terminal login, then retry the
read. Tool calls never start browser approval. A different account clears the process's default farm.

## Workflows

Three workflows cover the common work. Full steps, required inputs, and recovery rules are in
[Workflows](https://github.com/RanchBot/mcp-server/blob/main/docs/workflows.md).

- **Find an animal and read its records.** `lookup_animal_by_eid` performs a read-only exact EID
  lookup and never creates inventory. For a tag or name, use `list_animals` and `list_identifiers`,
  then `get_animal` and `list_records`. If a lookup is ambiguous, ask which animal is meant.
- **Review, create, and read back an ordinary record.** Resolve and verify every intended animal or
  group in the selected farm before approval. Show the producer the name, type, date, attachments,
  and description, get explicit approval, call `create_record`, then read back the returned UUID
  with `get_record` and compare all values and attachment IDs. The API rejects the request when both
  attachment arrays are empty, but it keeps only active, in-farm targets: an invalid target is
  dropped, so a partially valid create can save a subset and an entirely invalid one can produce a
  record that no farm-scoped read can retrieve. `list_records` is not enough to verify attachments.
  If the read-back fails or the attachments differ, stop and contact support. Do not assume nothing
  was saved and do not recreate the record.
- **Preview and confirm a birth.** `preview_birth_event` validates a birth bundle without saving it
  and returns a confirmation hash. Show every field, get explicit approval, then call
  `confirm_birth_event` with the exact `request_id`, `bundle`, and `confirmation_hash`. A changed
  proposal needs a fresh preview and renewed approval.

These examples describe the current source server. The public setup page is the source of truth for
what a published release contains; describing a capability here is not a claim that it is released or
deployed.

## Tool surface

The server exposes farm-scoped tools for farms and current farm context; animals and identifiers;
groups; health, movement, feed, genetic, and other records; atomic birth events, linked follow-up
tasks, and immutable farm protocol versions; and read-only Farm Memory.

`list_birth_events` and `get_birth_event` retrieve saved events; `list_farm_tasks` includes undated
TODOs, and `update_farm_task` changes status or the optional due date. `list_protocol_versions` and
`create_protocol_version` use producer-provided immutable steps without inventing care instructions.

`get_birth_source_evidence` reads the source author's retained SMS media status and current-farm
identity candidates. It requires `read:records`, `read:animals`, and current farm access. Partial or
ambiguous matches require producer selection before birth confirmation.

## Write and access boundaries

External MCP writes execute directly under the server's granted access. They **bypass the Ranch.Bot
app's review-before-saving screen** and **do not create the Action rows behind Change History**.
Verify every write by reading it back. Review the operation, farm, resolved targets, exact values,
and consequences with the producer, and obtain explicit approval before any write.

- **Roles and scopes both apply.** Readers can read, including the safe `lookup_animal_by_eid`.
  Editors or Owners can run the applicable create and update operations and confirm a birth.
  Deleting animals, groups, records, or identifiers needs Owner access. Birth confirmation also
  needs the `write:records`, `write:animals`, and `write:groups` scopes. Required OAuth scopes are an
  additional condition on top of the farm role, so a missing scope and a missing role are separate
  problems.
- **Never automatically replay a write.** If a write times out or its result is unclear, stop and
  reconcile with reads before proposing anything else.
- **Safe lookup before creation.** `lookup_animal_by_eid` is read-only. `find_or_create_animal_by_eid`
  and the deprecated `find_animal_by_identifier` create inventory on a miss and require explicit
  intent to create.

### Birth safety

Before confirmation only, changes to an unconfirmed proposal or its referenced evidence require a
fresh preview and renewed producer approval. An unchanged retry of the exact approved tuple returns
the already-saved event; it is not a correction. If a confirmation outcome is uncertain, reconcile
with reads before any further write.

Saved birth correction is not currently supported. To correct a saved birth, stop and refer the
producer to https://ranch.bot/support. Do not promise an amendment. Never re-record a saved birth
through a new preview/confirmation, a new `request_id`, stripped or forged source provenance, or
generic animal, record, or task edits, even with producer approval.

See [Architecture](https://github.com/RanchBot/mcp-server/blob/main/docs/architecture.md) for which
component enforces each guarantee.

## Jobs for an external assistant

A producer can authorize a local assistant to reconcile years of lambing spreadsheets, iPhone
notes, messages and livestock PDFs against a selected farm. Existing operator preparation of
records motivates these examples; customer demand and model accuracy remain unmeasured. MCP
provides structured farm operations, not a call to Ranch.Bot's conversation loop.

- **Historical reconciliation:** match existing animals and births, explain conflicts, and enumerate
  exact missing records before asking the producer to approve only the listed changes.
- **Custom reports:** read the relevant inventory and history, then report dated findings with saved
  IDs and missing evidence made explicit.
- **Combined evidence:** compare farm history with an authorized lender or AgriStability inventory
  snapshot for the same population and date. Totals are aggregate evidence, not individual animals
  or proof of current group membership; this is livestock reconciliation, not financial advice.

Inspect the connected tool list and schemas first. Use `list_my_farms`, confirm the farm with the
user, and pass `farm_id` explicitly. Where supported, `list_animals` accepts
`inventory_status: "ALL"`, `skip` and `take`; `list_records` accepts `skip` and `take` and also
accepts `type`, but the current HTTP endpoint ignores `type`, so `skip` and `take` are the only
effective query controls. Filter a page by each record's own `type` locally, advance by the returned
row count and the unfiltered `total`, and keep going past pages with no match. Follow
returned `total` and actual rows until coverage is complete. `list_groups` has no pagination inputs;
never assume all tools share one schema. `ALL` excludes soft-deleted animals. Read linked details
and saved births as needed; do not match through a find-or-create tool.

Classify every source item as proposed, already matched, duplicate, unresolved, or explicitly
excluded, retaining file/sheet/page/row provenance. Show exact operations, targets and values;
obtain approval, execute, then read back saved IDs and relationships. On partial failure or a lost
response, stop and reconcile with reads before another write. Keep that coverage ledger with the
source files; MCP does not persist it automatically. The
[reconciliation recipe](skills/ranchbot/SKILL.md#mixed-source-reconciliation) covers ambiguous
identities, event dates and unsupported birth cases. Ordinary access does not grant the separate
admin concierge-import workflow.

## Agent skill

The package ships the same public Agent Skill bundle as the CLI at `skills/ranchbot` (`SKILL.md`
plus `references/`). It teaches an agent task selection, approvals, multi-step workflows, and
recovery; it is guidance, not a capability or a security boundary. It does not install the server,
configure your client, authenticate you, or authorize farm operations.

Install the existing bundle with the Agent Skills installer:

```bash
npx skills add RanchBot/mcp-server --skill ranchbot
```

The CLI ships the same bundle and offers the equivalent route:
`npx skills add RanchBot/cli --skill ranchbot`. Install **one** copy, inspect the source, and choose
the agent/project scope your installer offers; you can also copy the entire `ranchbot` folder into a
skill directory your host supports. The installer is third-party tooling and may emit its own
telemetry and directory discovery; installing a skill promises no listing or ranking benefit.

## Sign out and recover

```bash
ranchbot-mcp logout
```

Sessions refresh automatically when needed. Logout revokes the session before clearing the local
cache; if revocation fails, the credentials are kept so you can retry. A tool call without a session
returns terminal-login instructions; it does not start browser approval. Help and version need no
login. Diagnose login, farm selection, access, lock, and upgrade problems with
[Troubleshooting](https://github.com/RanchBot/mcp-server/blob/main/docs/troubleshooting.md).

## Development and verification

A source checkout can run credential-free dependency, build, and unit checks without a Ranch.Bot
account:

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

CI runs these on Linux (including the full suite) and runs the native lock and session tests on
macOS and Windows. See
[Development](https://github.com/RanchBot/mcp-server/blob/main/docs/development.md) for focused test
commands, authenticated development-server setup, environment variables, installation-local mode,
and the self-hosted HTTP transport. A green local suite is not release or deployment evidence.

## Documentation

- [Workflows](https://github.com/RanchBot/mcp-server/blob/main/docs/workflows.md): the supported farm workflows.
- [Architecture](https://github.com/RanchBot/mcp-server/blob/main/docs/architecture.md): the request path and who enforces what.
- [Development](https://github.com/RanchBot/mcp-server/blob/main/docs/development.md): checks, the authenticated development server, and packaging.
- [Troubleshooting](https://github.com/RanchBot/mcp-server/blob/main/docs/troubleshooting.md): login, farm selection, lock, and access problems.
- [Contributing](https://github.com/RanchBot/mcp-server/blob/main/CONTRIBUTING.md)
- [Security](https://github.com/RanchBot/mcp-server/blob/main/SECURITY.md)
- [Maintaining](https://github.com/RanchBot/mcp-server/blob/main/MAINTAINING.md): maintainer
  procedures: admin import sign-in, EID lookup and compatibility, token-cache locking and upgrades,
  and installation-local sessions.

## Support

Email [support@ranch.bot](mailto:support@ranch.bot) with the package version from
`ranchbot-mcp --version`. Do not include tokens, credentials, or customer records.

## License

MIT. See [LICENSE](LICENSE).
