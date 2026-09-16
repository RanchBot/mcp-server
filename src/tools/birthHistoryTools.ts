import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { birthHistorySettingsJsonSchema } from '../generated/birthHistorySchema';

const farm = {
  farm_id: {
    type: 'string',
    format: 'uuid',
    description: 'Farm UUID; defaults to the active farm.',
  },
};
export const birthHistoryTools: Tool[] = [
  {
    name: 'get_birth_history_settings',
    description:
      'Read producer-configured species gestation/age intervals and zero-to-many planned birth windows.',
    inputSchema: { type: 'object', properties: farm, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'set_birth_history_settings',
    description:
      'Replace explicit producer-approved birth-history settings. Never invent biological interval defaults; an empty birth_windows array means no planned windows.',
    inputSchema: {
      type: 'object',
      properties: { ...farm, settings: birthHistorySettingsJsonSchema },
      required: ['settings'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'get_birth_history_evidence',
    description:
      'Read dated exposures, recorded historical membership and movement comparisons for a dam/birth date. Presumed sire evidence is a review proposal and never DNA confirmation or an automatic parentage write.',
    inputSchema: {
      type: 'object',
      properties: {
        ...farm,
        dam_id: { type: 'string', format: 'uuid' },
        birth_date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      },
      required: ['dam_id', 'birth_date'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
];
