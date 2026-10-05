# Workflows

Three farm workflows an MCP client can run against one Ranch.Bot farm at a time: find an animal and
read its records, review and save an ordinary record, and preview and confirm a birth. Every tool
call is farm-scoped and uses the caller's granted access. For first-time setup, see the
[README](../README.md).

Before any write, present the operation, farm, resolved targets, exact values, and consequences to
the producer, and obtain explicit approval. One approval may cover an explicitly listed batch; a
changed scope needs approval again. The server enforces permissions, but it cannot enforce an
assistant's approval step, so the client owns that boundary.

## Select the farm first

Call `list_my_farms` to see the farms the account can reach. If the producer named a farm, use it.
If more than one farm is plausible and the producer did not name one, ask; do not guess.

Use `set_default_farm` only when the producer asks to change the working farm. Otherwise pass an
explicit `farm_id` on each scoped call. `get_current_context` reports the saved default. A
replacement session for a different principal clears the in-process farm selection.

## Find an animal and read its records

Required inputs: the farm, and either an exact EID or enough identity to find the animal (tag,
name, or a browse).

1. **Resolve the farm** as above.
2. **Exact EID read:** call `lookup_animal_by_eid` with `eid` (and optional `farm_id`). It is
   read-only and requires Reader access. It searches exact active EIDs on active animals across
   inventory statuses. No match returns a not-found error; more than one matching animal returns
   an ambiguity error. Neither case creates inventory.
3. **Other identifiers:** call `list_animals` to find candidates (`inventory_status` defaults to
   `CURRENT`; pass `ALL` to include historical profiles), then `list_identifiers` for an animal's
   tags, names, EID, brand, or tattoo. Use `list_groups` and `get_group` for group context.
4. **Read the profile:** `get_animal` by animal UUID.
5. **Read records:** `list_records` accepts a `type` (`FEED`, `GENETIC`, `HEALTH`, `MOVEMENT`,
   `OTHER`), but the current HTTP endpoint ignores it and returns every type. Retrieve pages and
   filter each returned record by its own `type` locally. Advance by the number of returned rows and
   the unfiltered `total`, and continue past a page with no match; a page with no matching records
   does not end the search. Then use `get_record` to inspect the affected animals and groups when you
   are selecting records for a specific animal. Saved births use `list_birth_events` and
   `get_birth_event`.

If an identifier matches more than one animal, or two farms are plausible, stop and ask the
producer which one they mean. Never pick on their behalf.

### Safe lookup versus creation

`lookup_animal_by_eid` never changes data. Two other tools look similar but **create inventory**
when nothing matches:

- `find_or_create_animal_by_eid` creates an animal on a miss. It requires Editor access and an
  explicit intent to create inventory.
- `find_animal_by_identifier` is deprecated and still creates inventory for compatibility.

Use `lookup_animal_by_eid` for every read. Use `find_or_create_animal_by_eid` only for intentional
creation, after explicit approval. Never call either creation tool to answer a lookup question.

## Review, create, and read back an ordinary record

Required inputs: the farm, a `name`, a `type` (`FEED`, `GENETIC`, `HEALTH`, `MOVEMENT`, or
`OTHER`), an `applied_at` ISO date/time, and at least one resolved `animal_ids` or `group_ids`
UUID. `description` is optional.

1. **Resolve and verify the targets** with the read workflow above and keep the exact UUIDs. Confirm
   that every intended animal or group is active and belongs to the selected farm before approval.
   If a name or tag is ambiguous, ask.
2. **Review before writing:** show the producer the name, type, date, attached animals/groups, and
   description, and get explicit approval. Never invent dates, doses, or animals.
3. **Create** with `create_record`. The API rejects the request when both attachment arrays are
   omitted or empty, and a failed call returns an MCP error, not a saved record. This is only an
   input-length check: the service keeps the active animals and groups that belong to the selected
   farm and silently drops nonexistent, archived, soft-deleted, or other-farm UUIDs. This endpoint
   does not enable `requireAllAttachments`. A mixed valid/invalid list can therefore save only a
   subset, and an entirely invalid list can create an orphan record that no farm-scoped read can
   retrieve.
4. **Read back** with `get_record` using the returned record UUID. Compare every value and all
   animal/group attachment IDs against the approved operation. `list_records` alone is not enough:
   a record attached to nothing would not appear in any animal's history, so verify the attachments
   directly.
5. **If the read-back fails or the attachments differ,** stop and contact
   [support](https://ranch.bot/support). Do not assume nothing was saved, and do not automatically
   recreate the record.

If the create result is uncertain, read back before doing anything else. Never automatically replay
a mutation.

## Preview and confirm a birth

A birth is saved only through `preview_birth_event` followed by `confirm_birth_event`, using the
producer-approved exact preview tuple. Required inputs: the farm, a stable `request_id` UUID, and a
`bundle` (dam, offspring, dates, and any protocol or evidence references). `confirmation_hash` is
added only at confirmation.

1. **Resolve the dam and referenced evidence** with reads. `get_birth_source_evidence` reads the
   source author's retained SMS media status and current-farm identity candidates; partial or
   ambiguous matches require the producer to choose before confirmation.
2. **Preview** with `preview_birth_event` (`request_id` + `bundle`). It validates and returns the
   complete bundle, resolved evidence, and a confirmation hash. It does not save farm data.
3. **Review and approve:** show the producer every field and all resolved details, and obtain
   explicit approval of that exact preview. Preserve the exact `request_id`, `bundle`, and
   `confirmation_hash` for the confirmation call.
4. **Confirm** with `confirm_birth_event` using that exact tuple. Confirmation requires Editor
   access and the `write:records`, `write:animals`, and `write:groups` scopes.
5. **Read back** with `get_birth_event` or `list_birth_events` to verify the saved event.

Rules that keep a birth safe:

- **Changed proposals need a fresh preview.** Before confirmation only, any change to the proposal
  or its referenced evidence requires another `preview_birth_event` and renewed approval. Never
  confirm a stale preview and never generate or reuse a hash.
- **An unchanged retry is a retrieval.** Repeating the exact approved tuple returns the already-saved
  event. That is not a correction.
- **An uncertain outcome needs reads first.** If a confirmation times out or its result is unclear,
  reconcile with reads before any further write.
- **Saved-birth correction is unsupported.** A saved birth cannot be corrected through these tools.
  Stop and refer the producer to [support](https://ranch.bot/support) without promising an
  amendment. Never re-record a saved birth to correct it: do not send a corrected bundle through a
  new preview or confirmation, substitute a new `request_id`, strip or forge source provenance, or
  fall back to generic animal, record, or task edits, even with producer approval.

Related birth tools: `list_farm_tasks` includes undated TODOs, and `update_farm_task` changes a
task's status and optional due date. `list_protocol_versions` and `create_protocol_version` use
producer-provided immutable steps; never invent care instructions.

## Pagination

List tools that return many rows accept `skip` (records to skip) and `take` (page size, 1–200).
Pagination is per tool, not a universal contract:

| Tool                              | `skip` / `take` | Notes                                           |
| --------------------------------- | --------------- | ----------------------------------------------- |
| `list_animals`                    | yes             | Filter with `inventory_status`.                 |
| `list_records`                    | yes             | `type` is accepted but ignored; filter locally. |
| `list_feedings`                   | yes             | Filter with `status` or `since`.                |
| `list_birth_events`               | yes             | Optional `animal_id`.                           |
| `list_farm_tasks`                 | yes             | Optional `status`.                              |
| `list_protocol_versions`          | yes             |                                                 |
| `list_groups`, `list_identifiers` | no              | Return the farm/animal's rows directly.         |

`list_records` forwards `type` to the API, but the current HTTP endpoint ignores it and applies
only `skip` and `take`. Treat `type` as a local filter: page through the unfiltered rows, inspect
each record's `type`, and advance using the number of rows returned and the unfiltered `total`, not
the count of matches. A page with no matching records is not the end. If pagination stops making
progress before you have covered `total`, report incomplete coverage rather than a complete result.

## Related

- [Architecture](architecture.md): where validation, authorization, and guarantees live.
- [Development](development.md): credential-free checks and authenticated development use.
- [Troubleshooting](troubleshooting.md): login, lock, access, and recovery problems.
