import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { birthBundleInputSchema } from '../generated/birthBundleSchema';

const farm = { farm_id: { type: 'string', format: 'uuid' } };
const page = {
  skip: { type: 'integer', minimum: 0 },
  take: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
};
const request = {
  ...farm,
  request_id: {
    type: 'string',
    format: 'uuid',
    description: 'Stable request UUID. Preserve it across preview, confirmation, and retries.',
  },
  bundle: birthBundleInputSchema,
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

export const birthEventTools: Tool[] = [
  define(
    'preview_birth_event',
    'Validate and preview one atomic birth event without saving farm data. Show the producer every bundle field and all resolved dam, group, protocol, and evidence details. Obtain explicit approval of this exact preview before calling confirm_birth_event. Any correction requires another preview.',
    request,
    ['request_id', 'bundle'],
    true,
  ),
  define(
    'confirm_birth_event',
    'Save one complete producer-approved birth bundle. Only call after the producer explicitly approves the exact preview. Preserve its request_id, bundle, and confirmation_hash; never generate the hash or silently obtain and approve a fresh preview. A stale preview must be reviewed again.',
    { ...request, confirmation_hash: { type: 'string', pattern: '^[a-f0-9]{64}$' } },
    ['request_id', 'bundle', 'confirmation_hash'],
    false,
  ),
  define(
    'list_birth_events',
    'List saved birth events with bounded pagination, optionally filtered by dam or offspring.',
    { ...farm, ...page, animal_id: { type: 'string', format: 'uuid' } },
    [],
    true,
  ),
  define(
    'get_birth_event',
    'Retrieve a saved birth event and evidence the current user may access.',
    { ...farm, event_id: { type: 'string', format: 'uuid' } },
    ['event_id'],
    true,
  ),
  define(
    'get_birth_source_evidence',
    'Read your retained SMS birth source, ordered media status, and current-farm identity candidates. Requires the source author’s current farm access. Partial or ambiguous matches require producer selection; this lookup does not approve identities or save a birth.',
    { ...farm, source_sms_id: { type: 'string', format: 'uuid' } },
    ['source_sms_id'],
    true,
  ),
  define(
    'list_farm_tasks',
    'List farm follow-up work, including undated todos.',
    { ...farm, ...page, status: { type: 'string', enum: ['TODO', 'DONE', 'CANCELLED'] } },
    [],
    true,
  ),
  define(
    'update_farm_task',
    'After producer approval, update task status and optionally its due date. An explicit null clears the date; omission preserves it.',
    {
      ...farm,
      task_id: { type: 'string', format: 'uuid' },
      status: { type: 'string', enum: ['TODO', 'DONE', 'CANCELLED'] },
      due_date: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    },
    ['task_id', 'status'],
    false,
  ),
  define(
    'list_protocol_versions',
    'List immutable farm protocol definitions with bounded pagination. Never invent missing steps.',
    { ...farm, ...page },
    [],
    true,
  ),
  define(
    'create_protocol_version',
    'Create a producer-approved immutable farm protocol version from the exact named steps provided. Do not invent or prescribe care steps.',
    {
      ...farm,
      name: { type: 'string', minLength: 1, maxLength: 80 },
      version: { type: 'string', minLength: 1, maxLength: 80 },
      steps: {
        type: 'array',
        minItems: 1,
        maxItems: 40,
        items: { type: 'string', minLength: 1, maxLength: 1000 },
      },
    },
    ['name', 'version', 'steps'],
    false,
  ),
];
