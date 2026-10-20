# Birth events reference

Recording a birth is a two-step, producer-approved workflow shared by the CLI and MCP server. It
supports observation-only, existing-offspring, new-offspring and mixed captures, with reviewed
relationships, care records, tasks and evidence links in one transaction. Existing offspring keep
their status and identifiers; new profiles need explicit sex and inventory status. A reported total
never invents profiles. Configured templates expose their own input fields; inspect that schema.
Availability is capability-dependent: if the connected release does not expose the birth commands
or tools, stop and explain — do not fall back to generic animal or record writes.

This reference describes the **direct-bundle compatibility path**. For a farm-selected template,
use [configured births](workflows.md): literal definition keys, resolved defaults/units,
`preview_workflow` and `commit_workflow`. Do not switch paths to bypass a denial or recover an
uncertain save. Both paths share the birth writer and the correction boundary below.

## Preview

Send a caller-generated `request_id` UUID and the complete `bundle`. Preview reads current identity,
group, protocol, and source evidence and saves **no** farm data. It returns the complete resolved
bundle, review, evidence, and a `confirmation_hash`.

## Approval

Review the whole result with the producer. Show every field the producer must own — offspring
labels, existing versus new profiles, explicit sex/status for creations, reported total, weights,
dated care and supplementation, protocol version or unresolved claim,
group membership, evidence assignments, sire claim, and follow-up dates. Review labels are
temporary; they are never animal identifiers. Get explicit approval of that exact preview. Do not
treat silence, an earlier approval, or a similar-looking birth as approval.

**Before confirmation only:** any correction, changed field, or changed referenced review data in
an unconfirmed proposal requires a fresh preview and renewed approval. A stale preview must be
reviewed again. This does not apply to a saved event.

## Confirmation

Send the same `request_id`, the **exact** reviewed `bundle`, and the `confirmation_hash` from that
preview. Confirmation requires editor access and the `write:records`, `write:animals`, and
`write:groups` scopes.

- The `request_id` is caller-generated and stable across preview, confirmation, and retries.
- The `confirmation_hash` must be the value **returned by the preview**. Never invent, guess,
  truncate, or reuse a hash from a different preview.
- Never fabricate a hash and never fall back to generic CRUD to force a save.

## Retry and recovery

An explicitly requested retry may reuse the exact approved `request_id`, `bundle`, and
`confirmation_hash`. Under the idempotency contract, repeating the same request and hash returns
its already-saved event; it is a retrieval, not a correction. A different payload cannot reuse that
request ID. If a confirmation outcome is uncertain, reconcile with reads before any further write.

<a id="unsupported-corrections"></a>

## Saved amendments and entered-in-error

When the connected release exposes it, use `preview_workflow` with `operation: "amend_birth"`
(CLI: `workflows preview --data @amendment.json`). Read the saved birth and its canonical record
first. Supply `record_id`, the reviewed `expected_revision`, a producer-supplied `reason`, and
`amendment_operation: "amend"` with supported `changes`, or `"entered_in_error"` to invalidate it.
Inspect the connected schema: this is not a generic offspring-profile editor. Missing capability
means stop and contact https://ranch.bot/support; do not promise an unavailable amendment.

Review all proposed changes and retained related work, obtain explicit approval, then use
`commit_workflow` with the same `preview_id` and
`approval: {confirmed: true, preview_hash: <reviewed hash>}`. The CLI equivalent is
`workflows commit <preview_id> --approve <preview_hash>`. Approval attestations bind reviewed
inputs; they do not prove a human reviewed them. A stale revision, changed input or changed
relevant state requires another preview and renewed approval. After an uncertain commit read
`get_workflow_preview` first; a committed preview returns its receipt. Verify the canonical record,
active offspring links and derived facts through reads before declaring completion.

Invalidation preserves offspring profiles, care records, tasks, inventory status and memberships.
It deactivates the birth and active offspring links and removes birth-derived facts; independently
stored profile birth dates survive. Care records can be edited separately, but generic deletion or
whole-bundle undo of the birth remains refused. Do not treat invalidation as deleting the animals.

Never re-record a saved birth as a correction. Do not substitute a new `request_id` for capture,
strip or forge source provenance, or edit/delete protected components to bypass amendment review:
that can duplicate offspring and care while leaving the original event in place. A new amendment
preview has its own request identity; that is not permission to create a replacement birth.
An unchanged successful capture retry retrieves the saved event, not a correction. Read before
retrying any uncertain write and never switch interfaces as recovery.

## Synthetic payload examples

These examples are illustrative synthetic data. Replace the UUIDs with real identifiers from the
authorized farm; the producer must review the previewed values, not these samples.

Minimal preview request:

```json
{
  "request_id": "11111111-1111-4111-8111-111111111111",
  "bundle": {
    "dam_id": "22222222-2222-4222-8222-222222222222",
    "birth_date": "2026-09-04",
    "time_precision": "morning",
    "offspring": [{ "review_label": "Lamb A", "sex": "female", "inventory_status": "CURRENT" }]
  }
}
```

Fuller preview request with observations and care:

```json
{
  "request_id": "33333333-3333-4333-8333-333333333333",
  "bundle": {
    "dam_id": "22222222-2222-4222-8222-222222222222",
    "birth_date": "2026-09-04",
    "time_precision": "afternoon",
    "maternal_observations": [{ "date": "2026-09-04", "text": "Dam attentive and nursing" }],
    "offspring": [
      {
        "review_label": "Twin A",
        "sex": "female",
        "inventory_status": "CURRENT",
        "birth_weight": { "value": 4.2, "unit": "kg" },
        "vigor": [{ "date": "2026-09-04", "text": "Stood within five minutes" }],
        "supplementation": [
          {
            "date": "2026-09-04",
            "substance": "Colostrum",
            "amount": 60,
            "unit": "ml",
            "source": "Own dam"
          }
        ]
      },
      { "review_label": "Twin B", "sex": "male", "inventory_status": "CURRENT" }
    ],
    "sire": { "status": "unknown" },
    "follow_up": [{ "name": "Check navels", "offspring_labels": ["Twin A", "Twin B"] }],
    "unresolved": []
  }
}
```

Confirmation request shape (the hash below is a synthetic placeholder; always use the value the
preview returned for that exact bundle):

```json
{
  "request_id": "11111111-1111-4111-8111-111111111111",
  "bundle": {
    "dam_id": "22222222-2222-4222-8222-222222222222",
    "birth_date": "2026-09-04",
    "time_precision": "morning",
    "offspring": [{ "review_label": "Lamb A", "sex": "female", "inventory_status": "CURRENT" }]
  },
  "confirmation_hash": "0000000000000000000000000000000000000000000000000000000000000000"
}
```
