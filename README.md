# Ranch.Bot MCP Server

Read and write cattle and sheep records through a local MCP server on your own computer. It uses
your Ranch.Bot account over the stdio transport and exposes one farm at a time; Ranch.Bot operates
no hosted MCP endpoint.

Requirements: Node.js 22 or newer, a Ranch.Bot account, and access to a farm.

## Install and sign in

These commands install this source package's version (0.1.6). For the recommended public release,
use the pinned command on [MCP setup](https://ranch.bot/docs/mcp-setup), the source of truth for
setup; release status and promotion rules live in [MAINTAINING.md](MAINTAINING.md). Stop older CLI
and MCP processes before upgrading; never remove their active lock files.

```bash
npm install -g @ranchbot/mcp-server@0.1.6
ranchbot-mcp --version
ranchbot-mcp login
```

Open the printed URL, sign in, and explicitly approve the displayed code and requested access in
your browser. No API key is needed. If login expires, run `ranchbot-mcp login` again; sign out with
`ranchbot-mcp logout`. See
[Troubleshooting](https://github.com/RanchBot/mcp-server/blob/main/docs/troubleshooting.md) for
access-denied and session problems, and keep passwords and token files out of assistant messages.

## Configure a local stdio client

Point an MCP client at the installed command with no arguments:

```json
{
  "mcpServers": {
    "ranchbot": { "command": "ranchbot-mcp", "args": [] }
  }
}
```

If the client cannot find the command, use its absolute executable path. Restart the client after
changing configuration. `ranchbot-mcp --help` and `ranchbot-mcp --version` work without
authentication. Any MCP client that can run a local stdio server works; this is not a certification
of any named client.

## First successful read

Ask the client to call these tools in order:

1. `list_my_farms` with `{}`. Choose the intended farm ID. If more than one farm is plausible and
   the producer did not name one, ask instead of guessing.
2. `list_animals` with `{"farm_id":"<farm_id>"}`, replacing the placeholder with that ID.

An empty list is a successful read. Pass `farm_id` explicitly on every scoped call; setting a
default with `set_default_farm` is optional. If access is denied, check the account and farm
membership; missing authentication means terminal login, then retry. Tool calls never start browser
approval. A different account clears the process's default farm.

A useful read-only task: "Summarize the selected farm's current inventory." Read the complete
relevant population, follow each operation's pagination (`skip`/`take`) and returned `total`, and
report incomplete retrieval rather than presenting a first page as the whole answer.

## Writing farm data

Ordinary writes save directly under your server permissions, without the app confirmation screen
or its Change History. Before any mutation, present the operation, farm, resolved targets, exact
values, and consequences and get explicit approval. Read the result back afterwards. If the outcome
is uncertain, reconcile with reads before proposing another write.

Roles and scopes both apply: Readers can read, including the safe `lookup_animal_by_eid`; Editors or
Owners can create and update and confirm a birth; deleting animals, groups, records, or identifiers
needs Owner access. Birth confirmation also needs the `write:records`, `write:animals`, and
`write:groups` scopes. A missing scope and a missing role are separate problems.

Births use a dedicated `preview_birth_event` → approval → `confirm_birth_event` workflow. A saved
birth cannot be corrected through these tools: stop and refer the producer to
[support](https://ranch.bot/support) without promising an amendment. Read the
[birth events reference](skills/ranchbot/references/birth-events.md) before handling births.

Farms can configure a versioned `record_birth` template that drives the shared
`preview_workflow` → approval → `commit_workflow` flow. The `list_workflow_templates`,
`get_workflow_template`, `create_workflow_template`, `publish_workflow_template_version`,
`update_workflow_template_state`, and `set_default_workflow_template` tools manage that
configuration (Owner writes with `write:farms`). After upgrading from a login that lacks
`write:farms`, run `ranchbot-mcp login` and approve a fresh authorization. Refresh preserves the
existing grant; it cannot add scopes. A new grant does not elevate your farm role.
Commit requires the exact `preview_hash` read back from a fresh
preview; a stale hash is rejected. Templates change
labels, visibility, defaults, and custom observations only — the meaning and review controls of
core birth fields do not change. See the [workflow guide](docs/workflows.md) for the run and
configuration steps.

## Agent skill

The package ships the public Agent Skill bundle at `skills/ranchbot` (`SKILL.md` plus
`references/`). It is optional guidance, not a capability or a security boundary; installation
details are in the [MCP reference](skills/ranchbot/references/mcp.md).

## Task references

- [MCP reference](skills/ranchbot/references/mcp.md) — connection, tool discovery, farm context,
  errors, and optional skill installation.
- [Birth events reference](skills/ranchbot/references/birth-events.md) — preview, confirmation,
  retry, and unsupported corrections.
- [Exports reference](skills/ranchbot/references/exports.md) — archive create, poll, cancel, and
  download.
- [Mixed-source reconciliation](skills/ranchbot/SKILL.md#mixed-source-reconciliation) — historical
  imports, coverage ledgers, and lender-document caveats.

## Jobs for an external assistant

A producer can authorize a local assistant to reconcile years of lambing spreadsheets, iPhone notes,
messages, and livestock PDFs against one farm, produce custom reports, or compare farm history with
an authorized lender or AgriStability snapshot for the same population and date. Totals are
aggregate evidence, not individual animals or proof of current group membership; this is livestock
reconciliation, not financial advice. Follow the
[mixed-source reconciliation](skills/ranchbot/SKILL.md#mixed-source-reconciliation) recipe and the
[workflow](https://github.com/RanchBot/mcp-server/blob/main/docs/workflows.md) pagination rules; MCP
does not persist the coverage ledger.

## Package guides

- [Workflows](https://github.com/RanchBot/mcp-server/blob/main/docs/workflows.md) — find an animal,
  save an ordinary record, and preview and confirm a birth, with inputs, pagination, and recovery.
- [Architecture](https://github.com/RanchBot/mcp-server/blob/main/docs/architecture.md) — the
  request path and which component enforces each guarantee.
- [Troubleshooting](https://github.com/RanchBot/mcp-server/blob/main/docs/troubleshooting.md) —
  login, farm selection, lock, and access problems.
- [Development](https://github.com/RanchBot/mcp-server/blob/main/docs/development.md) —
  credential-free checks, the authenticated development server, and packaging.
- [Contributing](https://github.com/RanchBot/mcp-server/blob/main/CONTRIBUTING.md) — how changes
  reach this exported repository and where to send feedback.
- [Security](https://github.com/RanchBot/mcp-server/blob/main/SECURITY.md) — how to report a
  vulnerability privately.

## Maintainer instructions

See [MAINTAINING.md](MAINTAINING.md) for development, admin login, local installations, EID
migration, authentication troubleshooting, and detailed credential-lock recovery. For shell
commands, use [CLI setup](https://ranch.bot/docs/cli-setup). For everyday record entry, use
[SMS and web setup](https://ranch.bot/docs/getting-started). Support:
[support@ranch.bot](mailto:support@ranch.bot).

## License

MIT. See [LICENSE](LICENSE).
