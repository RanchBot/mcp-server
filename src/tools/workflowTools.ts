import { Tool } from '@modelcontextprotocol/sdk/types.js';

const farm = {
  farm_id: {
    type: 'string',
    format: 'uuid',
    description: 'Farm UUID; defaults to the active farm.',
  },
};
const page = {
  skip: { type: 'integer', minimum: 0 },
  take: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
};
const templateId = { type: 'string', format: 'uuid' };
const previewId = { type: 'string', format: 'uuid' };
const definitionSchema = {
  type: 'object',
  description:
    'Complete validated template definition: schema_version 1, workflow "record_birth", name, and fields. Core keys bind to the code-owned birth-field registry; labels never change field meaning.',
  properties: {
    schema_version: { type: 'number', const: 1 },
    workflow: { type: 'string', const: 'record_birth' },
    name: { type: 'string', minLength: 1, maxLength: 80 },
    fields: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          key: { type: 'string', minLength: 1, maxLength: 80 },
          scope: { type: 'string', enum: ['event', 'offspring'] },
          label: { type: 'string', minLength: 1, maxLength: 80 },
          required: { type: 'boolean' },
          hidden: { type: 'boolean' },
          default: { type: 'object', additionalProperties: true },
          unit: { type: 'string', enum: ['kg', 'lb'] },
          type: { type: 'string', enum: ['text', 'number', 'boolean', 'date', 'choice'] },
          choices: {
            type: 'array',
            items: {
              type: 'object',
              properties: { key: { type: 'string' }, label: { type: 'string' } },
              required: ['key', 'label'],
            },
          },
        },
        required: ['key', 'scope', 'label'],
        additionalProperties: false,
      },
    },
  },
  required: ['schema_version', 'workflow', 'name', 'fields'],
  additionalProperties: false,
};
const define = (
  name: string,
  description: string,
  properties: Record<string, object>,
  required: string[],
  readOnly: boolean,
): Tool => ({
  name,
  description,
  inputSchema: { type: 'object', properties, required, additionalProperties: false },
  annotations: { readOnlyHint: readOnly, destructiveHint: false, idempotentHint: true },
});

export const workflowTools: Tool[] = [
  define(
    'list_workflow_templates',
    'List farm-owned workflow templates with their current published version. Sheep farms receive Detailed and Minimal lambing starters on first use. Read-only.',
    { ...farm, ...page, workflow: { type: 'string', maxLength: 80 } },
    [],
    true,
  ),
  define(
    'get_workflow_template',
    'Read one farm-owned workflow template and every published version. Read-only.',
    { ...farm, template_id: templateId },
    ['template_id'],
    true,
  ),
  define(
    'create_workflow_template',
    'Create a farm-owned workflow template and its version 1. Requires the OWNER role. Publishing is a separate operation; never invent a definition the producer did not confirm.',
    { ...farm, definition: definitionSchema, is_default: { type: 'boolean' } },
    ['definition'],
    false,
  ),
  define(
    'publish_workflow_template_version',
    'Publish an immutable new template version. Requires the OWNER role and the exact expected_current_version; a stale value returns a conflict. Definitions cannot weaken handler invariants, hide indispensable controls, change core types, or invent units.',
    {
      ...farm,
      template_id: templateId,
      expected_current_version: { type: 'integer', minimum: 0 },
      definition: definitionSchema,
    },
    ['template_id', 'expected_current_version', 'definition'],
    false,
  ),
  define(
    'update_workflow_template_state',
    'Archive or reactivate a template. Requires the OWNER role and the exact expected_metadata_revision. Archiving the default template requires an active replacement_template_id in the same transaction.',
    {
      ...farm,
      template_id: templateId,
      expected_metadata_revision: { type: 'integer', minimum: 0 },
      is_active: { type: 'boolean' },
      replacement_template_id: templateId,
    },
    ['template_id', 'expected_metadata_revision', 'is_active'],
    false,
  ),
  define(
    'set_default_workflow_template',
    'Select the farm default template for its workflow. Requires the OWNER role and the exact expected_metadata_revision.',
    {
      ...farm,
      template_id: templateId,
      expected_metadata_revision: { type: 'integer', minimum: 0 },
    },
    ['template_id', 'expected_metadata_revision'],
    false,
  ),
  define(
    'preview_workflow',
    'Resolve one workflow run into a non-committable preview without creating livestock records. Resolves literal and today defaults once and returns structured field/domain issues. Show the producer the complete review, template version, defaults, custom answers and warnings before seeking approval for commit_workflow. A supplied or defaulted hidden value remains reviewable. Never guess a missing required answer.',
    {
      ...farm,
      request_id: {
        type: 'string',
        format: 'uuid',
        description:
          'Stable request UUID. Retrying the identical payload returns the same snapshot.',
      },
      template_id: templateId,
      template_version: { type: 'integer', minimum: 1 },
      inputs: {
        type: 'object',
        properties: {
          event: { type: 'object', additionalProperties: true },
          offspring: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
        additionalProperties: false,
      },
      timezone: {
        type: 'string',
        maxLength: 100,
        description: 'IANA timezone used once to resolve the "today" date default; never guessed.',
      },
      replaces_preview_id: previewId,
    },
    ['request_id', 'template_id', 'inputs'],
    true,
  ),
  define(
    'get_workflow_preview',
    'Read an authorized preview and, when committed, its saved outcome. The requesting actor must be the preview owner. Read-only.',
    { ...farm, preview_id: previewId },
    ['preview_id'],
    true,
  ),
  define(
    'commit_workflow',
    'Save one approved workflow preview through the single atomic birth writer. Requires the exact approval.confirmed true and the exact preview_hash of the preview the human reviewed: a bare preview id is insufficient. Do not describe the object or hash as cryptographic proof of a human click. This accepts no replacement inputs; a changed payload or relevant state requires a fresh preview and renewed approval. Do not generate a new preview as recovery from an uncertain commit — read get_workflow_preview first.',
    {
      ...farm,
      preview_id: previewId,
      approval: {
        type: 'object',
        properties: {
          confirmed: { type: 'boolean', const: true },
          preview_hash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
        },
        required: ['confirmed', 'preview_hash'],
        additionalProperties: false,
      },
    },
    ['preview_id', 'approval'],
    false,
  ),
  define(
    'discard_workflow',
    'Invalidate an uncommitted preview without livestock writes. Read-only scope but not a read; the requesting actor must be the preview owner.',
    { ...farm, preview_id: previewId },
    ['preview_id'],
    false,
  ),
];
