# Farm archive exports reference

A farm archive is a private ZIP of the data the signed-in user can access. It needs no subscription,
but availability is capability-dependent: if the connected release does not expose export commands
or the archive tool, stop and explain.

## Read versus write

- **Reads (no approval needed beyond the user's request):** listing exports and checking an export's
  status. These have no side effects on farm data.
- **Job creation and cancellation (approval needed):** `create` requests an archive job;
  `cancel` stops a pending job.
- **Local file writes (approval needed):** `download` writes a new ZIP to a local path. This is a
  write to the user's machine, not to farm data, but it must still have an approved destination.

## Workflow

1. Create the job only after the user asks for an archive:

   ```bash
   ranchbot exports create --farm <farm_id> --json
   ```

2. Poll status until it is ready; do not download before readiness:

   ```bash
   ranchbot exports list --farm <farm_id> --json
   ranchbot exports status <export_id> --farm <farm_id> --json
   ```

3. Agree on the destination path, then download:

   ```bash
   ranchbot exports download <export_id> --farm <farm_id> --output ./farm-archive.zip --json
   ```

4. Cancellation is available while a job is pending:

   ```bash
   ranchbot exports cancel <export_id> --farm <farm_id> --json
   ```

MCP exposes the same operations through `farm_archive` with `operation` set to `create`, `list`,
`status`, `cancel`, or `download` (plus an explicit `farm_id` and, for downloads, `output_path`).

## Downloads, readiness, and failures

- **Destination:** for the CLI, `--output <path>` names a local file. For MCP, `output_path` names a
  path **on the MCP host**, not on the user's chat machine. Confirm where the file lands before
  approving the download.
- **Refuse to overwrite:** downloads write a new file and refuse to overwrite an existing one. Choose
  a fresh path or let the user decide.
- **Checksum:** downloads verify the server's SHA-256 checksum and remove partial or invalid output
  on failure. A failed download is not a success; report it and do not claim the archive exists.
- **Readiness and expiry:** a job must be ready before it can be downloaded, and download access
  expires (currently about 24 hours). If it expired, create a new archive rather than retrying the
  old link.
- **Permissions:** export access is checked when the job is created and again when it is downloaded.
  Archive access stays subject to the user's farm permissions.

## Privacy boundaries

Treat archives as private farm data. They exclude other members' private conversations, account
credentials, and unrelated account and provider records; they are not a complete account backup.
Never upload, publish, or send an archive anywhere the user did not authorize, and never print its
contents into logs, issues, or shared transcripts.
