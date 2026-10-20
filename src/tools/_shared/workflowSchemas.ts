import { z } from 'zod/v3';
import { paginatedToolSchemas } from './listSchemas';

// Structural API contract only. Core-field meaning, farm state, and version compatibility
// remain backend-owned; shared fixtures test this copy against the API schema.
const key = z.string().trim().min(1).max(80);
const literal = z.union([
  z.string().max(1000),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(z.string().max(80)),
]);
const fieldDefault = z.union([
  z.object({ kind: z.literal('literal'), value: literal }).strict(),
  z.object({ kind: z.literal('today') }).strict(),
]);
const field = z
  .object({
    key,
    scope: z.enum(['event', 'offspring']),
    label: key,
    required: z.boolean().optional(),
    hidden: z.boolean().optional(),
    default: fieldDefault.optional(),
    unit: z.enum(['kg', 'lb']).optional(),
    type: z.enum(['text', 'number', 'boolean', 'date', 'choice']).optional(),
    choices: z
      .array(z.object({ key, label: key }).strict())
      .min(1)
      .max(50)
      .optional(),
  })
  .strict();

export const templateDefinitionSchema = z
  .object({
    schema_version: z.literal(1),
    workflow: z.literal('record_birth'),
    name: key,
    fields: z.array(field).min(1).max(200),
  })
  .strict();

const farm = {
  farm_id: z.string().uuid().optional().describe('Farm UUID; defaults to the active farm.'),
};
const template = { ...farm, template_id: z.string().uuid() };
const preview = z.object({ ...farm, preview_id: z.string().uuid() }).strict();

export const workflowToolSchemas = {
  list_workflow_templates: paginatedToolSchemas.list_workflow_templates,
  get_workflow_template: z.object(template).strict(),
  create_workflow_template: z
    .object({
      ...farm,
      definition: templateDefinitionSchema,
      is_default: z.boolean().optional(),
    })
    .strict(),
  publish_workflow_template_version: z
    .object({
      ...template,
      expected_current_version: z.number().int().min(0),
      definition: templateDefinitionSchema,
    })
    .strict(),
  update_workflow_template_state: z
    .object({
      ...template,
      expected_metadata_revision: z.number().int().min(0),
      is_active: z.boolean(),
      replacement_template_id: z.string().uuid().optional(),
    })
    .strict(),
  set_default_workflow_template: z
    .object({
      ...template,
      expected_metadata_revision: z.number().int().min(0),
    })
    .strict(),
  preview_workflow: z
    .object({
      ...farm,
      request_id: z
        .string()
        .uuid()
        .describe('Stable request UUID. Retrying the identical payload returns the same snapshot.'),
      operation: z
        .enum(['record_birth', 'amend_birth'])
        .optional()
        .describe(
          'Defaults to record_birth. Use amend_birth to correct or mark entered in error an existing BIRTH record.',
        ),
      template_id: z.string().uuid().optional(),
      template_version: z.number().int().positive().optional(),
      inputs: z
        .object({
          event: z.record(z.unknown()).optional(),
          offspring: z.array(z.record(z.unknown())).optional(),
        })
        .strict()
        .optional(),
      record_id: z
        .string()
        .uuid()
        .optional()
        .describe('amend_birth: the canonical BIRTH record being corrected.'),
      expected_revision: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('amend_birth: the record revision the producer reviewed.'),
      reason: z.string().trim().min(1).max(1000).optional(),
      amendment_operation: z
        .enum(['amend', 'entered_in_error'])
        .optional()
        .describe('amend_birth: correct facts (amend) or invalidate the event (entered_in_error).'),
      changes: z.record(z.unknown()).optional(),
      bundle: z
        .record(z.unknown())
        .optional()
        .describe(
          'Untemplated record_birth only: a complete birth bundle (observation-only, existing animal links, or inline new profiles). Mutually exclusive with template_id/inputs.',
        ),
      timezone: z
        .string()
        .min(1)
        .max(100)
        .optional()
        .describe('IANA timezone used once to resolve the "today" date default; never guessed.'),
      replaces_preview_id: z.string().uuid().optional(),
    })
    .strict(),
  get_workflow_preview: preview,
  commit_workflow: preview.extend({
    approval: z
      .object({
        confirmed: z.literal(true),
        preview_hash: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict(),
  }),
  discard_workflow: preview,
};
