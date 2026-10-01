# Ranch.Bot CLI reference

The CLI is the shell- and agent-harness surface for Ranch.Bot farm data. Requires Node.js 22 or
newer and a Ranch.Bot account with access to a farm. Setup happens once per machine and user; an
already-connected MCP client does not need the CLI.

## Install and sign in

The verified public pin is CLI `1.0.0`. Newer source versions may exist in the repository but are
not verified public releases.

```bash
npm install -g @ranchbot/cli@1.0.0
ranchbot --version
ranchbot --help
ranchbot login
```

Without a global install, replace `ranchbot` with `npx -y @ranchbot/cli@1.0.0`. `--version` and
`--help` work without signing in.

`ranchbot login` prints a URL and code. The user opens the URL in a browser and approves the code.
No API key is needed. `ranchbot logout` revokes the refresh session and removes local credentials.

## Discover the installed command surface

Read help from the installed binary; it reflects the release, not Ranch.Bot source:

```bash
ranchbot --help
ranchbot <group> --help
ranchbot <group> <command> --help
```

Common groups include `farms`, `animals`, `identifiers`, `groups`, `records`, `chute`, `rations`,
`feedings`, `memory`, `birth-events`, `birth-history`, `birth-sources`, `farm-tasks`, `protocols`,
and `exports`. Run the command-specific help before relying on a flag.

## Resolve the farm

```bash
ranchbot whoami --json
ranchbot farms list --json
ranchbot farms use <farm_id>
ranchbot animals list --farm <farm_id> --json
```

Prefer passing `--farm <id>` explicitly on scoped commands so the command does not depend on a saved
default. Use `farms use` only when the user asks to change their default. If more than one farm is
plausible and the user did not choose, ask.

## JSON, exit codes, and errors

- Every leaf command accepts `-j, --json`; agents should always set it.
- Success is machine-readable output on stdout with exit `0`.
- Failure is a `{ "error", "message", "status"? }` envelope on **stderr** with a non-zero exit.
  Check the exit status before parsing, and surface the error message rather than inventing one.

Auth-shaped failures tell the user to run `ranchbot login`. A missing farm tells the user to run
`ranchbot farms use <id>`.

## Pagination, inventory, and files

- `--skip <n>` and `--take <n>` page list commands. Read returned totals and continue until the task
  is covered; report incomplete retrieval honestly.
- `animals list` defaults to current inventory. Use `--inventory-status CURRENT`, `UNKNOWN`, `SOLD`,
  `DECEASED`, or `ALL`. `ALL` includes historical statuses where the API supports them, but not
  deleted profiles.
- Complex payloads (`--data`) accept inline JSON, `@file.json`, or `-` for stdin.
- `exports download <id> --output <path>` writes a new file and refuses to overwrite.

## Write boundary

Ordinary CLI writes run directly under the signed-in user's server permissions. They do not pause at
the Ranch.Bot app review screen and do not create the Action rows behind Change History. Explain the
operation, farm, target, and values and get the user's authorization before running a write, then
read the record back to verify it. The binary does not enforce an assistant's approval step.

Treat credential files as secrets and never print or share them. Do not edit or delete lock files
while clients are running, and stop older CLI/MCP processes before upgrading.

## Related references

- MCP equivalent: [mcp.md](mcp.md)
- Birth workflow: [birth-events.md](birth-events.md)
- Archive workflow: [exports.md](exports.md)
