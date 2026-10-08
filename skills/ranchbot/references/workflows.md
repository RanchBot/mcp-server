# Template-configured births

Use a farm's `record_birth` template when the producer wants its chosen lambing fields, labels,
defaults, units, and custom observations. This is distinct from the direct-bundle birth compatibility
path in [birth-events.md](birth-events.md); both use the same atomic birth writer. Never switch
paths or interfaces to bypass a denial or to replay an uncertain write.

## Discover access before promising a save

Check the connected MCP tool list or the installed CLI's `workflow-templates --help` and
`workflows --help`. Source documentation is not proof that an installed release supports these
operations. Missing capability means stop and explain. This guide does not promote a new release.

Owners configure templates with `write:farms`. Editors and Owners can use them; a scope never
raises a farm role. Reads of definitions need `read:farms`. Preview/read/discard need `read:records`;
commit also needs `write:records`, `write:animals`, and `write:groups`. Other record/profile reads
retain their own scopes. Never use an admin login as a workaround.

If an existing grant lacks `write:farms`, a supporting client must request it during a **fresh**
authorization (`ranchbot-mcp login` or `ranchbot login` as appropriate). Refresh preserves scopes;
it cannot expand access. If fresh authorization still lacks access, stop and report the denial.
Never ask for token files or credentials in chat.

## Configure with the Owner

Resolve one farm and pass its ID explicitly. List templates and retrieve the chosen starter's
`current_version.definition`. Sheep starters are Detailed and Minimal lambing. Show the complete
proposed definition, units and defaults to the Owner and obtain approval before configuration writes.

| Operation                                   | MCP                                                               | CLI group/command                                                               |
| ------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| List/read                                   | `list_workflow_templates`, `get_workflow_template`                | `workflow-templates list`, `get <template_id>`                                  |
| Create template **and published version 1** | `create_workflow_template`                                        | `workflow-templates create --data @create.json`                                 |
| Publish later immutable version             | `publish_workflow_template_version`                               | `workflow-templates publish <template_id> --data @publish.json`                 |
| Choose default/archive/reactivate           | `set_default_workflow_template`, `update_workflow_template_state` | `workflow-templates default <template_id>`, `state <template_id>` with `--data` |

Create takes `{definition,is_default?}`. Publish takes `{expected_current_version,definition}`;
read the current version first and re-review after a conflict. Default/state changes use
`expected_metadata_revision`, not the version number. Archiving the default requires an active
replacement. A label can change; core meaning/type cannot. A custom key cannot change type across
versions. Fostering notes are observations, not foster-parent relationships.

For MCP add `farm_id`, and `template_id` where needed. For CLI use `--farm <id> --json` on each
command. Never change a saved default unless the producer asked.

## Map the definition keys exactly

Use literal `key` strings, not display labels. Dots are part of the key, not nested objects.

| Definition field                                   | Template input                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `dam_id`, event                                    | `inputs.event.dam_id` (UUID)                                                                           |
| `birth_date`, event                                | `inputs.event.birth_date` (calendar date)                                                              |
| `groups`, event                                    | `inputs.event.groups` (UUID array)                                                                     |
| `lambing_ease`, event custom choice                | `inputs.event.lambing_ease` (choice key, not label)                                                    |
| `offspring.sex`, offspring                         | `inputs.offspring[0]["offspring.sex"]`                                                                 |
| `offspring.birth_weight`, offspring                | `inputs.offspring[0]["offspring.birth_weight"]` (number; template supplies unit)                       |
| `offspring.identifiers`, offspring                 | `inputs.offspring[0]["offspring.identifiers"]` (typed identifier array; keep leading zeros as strings) |
| `offspring.fostering_notes`, offspring custom text | `inputs.offspring[0]["offspring.fostering_notes"]`                                                     |

`lambing_ease` and `offspring.fostering_notes` exist only if that template defines them. Discover the real definition;
do not invent fields. Literal defaults apply only to omitted answers, never over explicit answers or
clears. A `today` default requires an explicit IANA `timezone`. Unknown keys and invalid answers fail.
Do not send the direct birth `bundle` shape as template `inputs`.

## Review and commit

1. Preview with MCP `preview_workflow` or CLI `workflows preview --data @preview.json --farm <id>
--json`. The payload contains a stable new `request_id`, `template_id`, `inputs.event` and
   `inputs.offspring`, plus `timezone` when needed. Optional `template_version` pins that version;
   omission chooses the current version once. Preview stores review state, not livestock records.
2. Display the entire response: `template_version`, `resolved_values`, `default_sources`,
   `validation_issues`, `review`, `proposed_changes`, expiry and `preview_hash`. Include hidden
   supplied/defaulted values, units, custom answers, dam identity/history, evidence and identifier
   warnings. Blocking issues prevent commit; advisory warnings still need review. Get explicit
   approval for this exact snapshot. Silence or an earlier approval is insufficient.
3. Read the preview again. Commit using MCP `{farm_id,preview_id,
approval:{confirmed:true,preview_hash}}` with `commit_workflow`, or CLI
   `workflows commit <preview_id> --approve <preview_hash> --farm <id> --json`. There are no replacement
   inputs at commit. The approval object is an attestation, not proof of a human click.
4. Read status with `get_workflow_preview` / `workflows get <preview_id>`, then saved birth,
   record and animal reads. Verify values, identifiers, groups and template/version provenance.

A newer publication alone does not invalidate a valid pinned preview. Changed relevant state, expiry,
archival or a mismatched hash can reject an uncommitted preview without new domain writes. Inspect
why, then obtain a fresh preview and renewed approval when appropriate. Do not silently re-plan.

After an uncertain commit, **read the existing preview first**. Committed status returns its saved
outcome. If pending or unreadable, stop and reconcile before any explicitly requested retry. Do not
make a new request ID as recovery. An identical successful retry returns the same receipt, not a
second birth. An uncommitted preview can be discarded explicitly. Saved-birth correction is still
unsupported; use the [birth correction boundary](birth-events.md#unsupported-corrections).

## Worked example

The source package's [configured-birth guide](https://github.com/RanchBot/mcp-server/blob/main/docs/workflows.md#run-a-configured-birth-workflow)
includes a runnable **disposable-loopback-only** example and the exact payload builders used by
persistence acceptance. It shows starter read, configuration approval, version 1 creation, version 2
publication, full resolved birth review, approval, commit and read-back. Made-up values are for the
test fixture, not instructions to create records on a real farm. Follow the installed release's
capabilities and the public setup guide; do not assume the source example has been published.
