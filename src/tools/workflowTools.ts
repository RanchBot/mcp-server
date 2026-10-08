import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { toInputSchema } from './_shared/inputSchemas';
import { workflowToolSchemas } from './_shared/workflowSchemas';

const define = (
  name: keyof typeof workflowToolSchemas,
  description: string,
  readOnly: boolean,
): Tool => ({
  name,
  description,
  inputSchema: toInputSchema(workflowToolSchemas[name]),
  annotations: { readOnlyHint: readOnly, destructiveHint: false, idempotentHint: true },
});

export const workflowTools: Tool[] = [
  define(
    'list_workflow_templates',
    'List farm-owned workflow templates with their current published version. Sheep farms receive Detailed and Minimal lambing starters on first use. Read-only.',
    true,
  ),
  define(
    'get_workflow_template',
    'Read one farm-owned workflow template and every published version. Read-only.',
    true,
  ),
  define(
    'create_workflow_template',
    'Create a farm-owned workflow template and its version 1. Requires the OWNER role. Publishing is a separate operation; never invent a definition the producer did not confirm.',
    false,
  ),
  define(
    'publish_workflow_template_version',
    'Publish an immutable new template version. Requires the OWNER role and the exact expected_current_version; a stale value returns a conflict. Definitions cannot weaken handler invariants, hide indispensable controls, change core types, or invent units.',
    false,
  ),
  define(
    'update_workflow_template_state',
    'Archive or reactivate a template. Requires the OWNER role and the exact expected_metadata_revision. Archiving the default template requires an active replacement_template_id in the same transaction.',
    false,
  ),
  define(
    'set_default_workflow_template',
    'Select the farm default template for its workflow. Requires the OWNER role and the exact expected_metadata_revision.',
    false,
  ),
  define(
    'preview_workflow',
    'Resolve one workflow run into a non-committable preview without creating livestock records. Resolves literal and today defaults once and returns structured field/domain issues. Show the producer the complete review, template version, defaults, custom answers and warnings before seeking approval for commit_workflow. A supplied or defaulted hidden value remains reviewable. Never guess a missing required answer.',
    true,
  ),
  define(
    'get_workflow_preview',
    'Read an authorized preview and, when committed, its saved outcome. The requesting actor must be the preview owner. Read-only.',
    true,
  ),
  define(
    'commit_workflow',
    'Save one approved workflow preview through the single atomic birth writer. Requires the exact approval.confirmed true and the exact preview_hash of the preview the human reviewed: a bare preview id is insufficient. Do not describe the object or hash as cryptographic proof of a human click. This accepts no replacement inputs; a changed payload or relevant state requires a fresh preview and renewed approval. Do not generate a new preview as recovery from an uncertain commit — read get_workflow_preview first.',
    false,
  ),
  define(
    'discard_workflow',
    'Invalidate an uncommitted preview without livestock writes. Read-only scope but not a read; the requesting actor must be the preview owner.',
    false,
  ),
];
