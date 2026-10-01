# Birth events reference

Recording a birth is a two-step, producer-approved workflow shared by the CLI and MCP server. It
creates offspring, dam relationships, care records, tasks, and evidence links in one transaction.
Availability is capability-dependent: if the connected release does not expose the birth commands
or tools, stop and explain — do not fall back to generic animal or record writes.

## Approval workflow

1. **Preview.** Send a caller-generated `request_id` UUID and the complete `bundle`. Preview reads
   current identity, group, protocol, and source evidence and saves **no** farm data. It returns the
   complete resolved bundle, review, evidence, and a `confirmation_hash`.
2. **Review the whole result with the producer.** Show every field the producer must own —
   offspring labels and sex, weights, dated care and supplementation, protocol version or unresolved
   claim, group membership, evidence assignments, sire claim, and follow-up dates. Review labels are
   temporary; they are never animal identifiers.
3. **Get explicit approval of that exact preview.** Do not treat silence, an earlier approval, or a
   similar-looking birth as approval.
4. **Confirm.** Send the same `request_id`, the **exact** reviewed `bundle`, and the
   `confirmation_hash` from that preview. Confirmation requires editor access and the
   `write:records`, `write:animals`, and `write:groups` scopes.

## Preserve the returned tuple

- The `request_id` is caller-generated and stable across preview, confirmation, and retries.
- The `confirmation_hash` must be the value **returned by the preview**. Never invent, guess,
  truncate, or reuse a hash from a different preview.
- **Before confirmation only:** any correction, changed field, or changed referenced review data
  in an unconfirmed proposal requires a fresh preview and a renewed approval. A stale preview must
  be reviewed again. This does not apply to a saved event.
- **Retries:** an explicitly requested retry may reuse the exact approved `request_id`, `bundle`,
  and `confirmation_hash`. Under the idempotency contract, repeating the same request and hash
  returns its already-saved event; it is a retrieval, not a correction. A different payload cannot
  reuse that request ID. Never fabricate a hash and never fall back to generic CRUD to force a save.
  If a confirmation outcome is uncertain, reconcile with reads before any further write.

## Corrections and unsupported edits

Saved birth correction is **not currently supported** by any public CLI or MCP operation. If a
producer asks to correct a saved birth, stop and refer them to https://ranch.bot/support; do not
promise that support will perform an amendment.

Never work around this by re-recording the saved birth. Do not send the corrected information
through a new preview/confirmation, substitute a new `request_id`, strip or forge SMS/source
provenance, delete or edit the saved event's components, or fall back to generic animal, record, or
task edits. A fresh request ID without the original SMS source reaches normal creation and can
duplicate offspring, birth and care records, and tasks while leaving the incorrect saved event in
place; generic edits bypass the birth transaction and its evidence links.

An unchanged retry of the exact approved tuple is not a correction: it returns the already-saved
event. If a confirmation outcome is uncertain, reconcile with reads before any further write.

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
    "offspring": [{ "review_label": "Lamb A", "sex": "female" }]
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
      { "review_label": "Twin B", "sex": "male" }
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
    "offspring": [{ "review_label": "Lamb A", "sex": "female" }]
  },
  "confirmation_hash": "0000000000000000000000000000000000000000000000000000000000000000"
}
```
