// Shared structural contract vectors; semantic/domain checks remain API-owned.
export const templateDefinition = {
  schema_version: 1,
  workflow: 'record_birth',
  name: 'Detailed lambing',
  fields: [
    { key: 'dam_id', scope: 'event', label: 'Ewe' },
    { key: 'birth_date', scope: 'event', label: 'Lambing date', default: { kind: 'today' } },
    { key: 'offspring.sex', scope: 'offspring', label: 'Sex' },
    { key: 'offspring.birth_weight', scope: 'offspring', label: 'Birth weight', unit: 'kg' },
  ],
};

const field = { key: 'notes', scope: 'event', label: 'Notes', type: 'text' };
const withField = (overrides: Record<string, unknown>) => ({
  ...templateDefinition,
  fields: [...templateDefinition.fields, { ...field, ...overrides }],
});
const choice = { key: 'easy', label: 'Unassisted' };

export const templateDefinitionCases: Array<[string, unknown, boolean]> = [
  ['starter', templateDefinition, true],
  ['trimmed labels', { ...templateDefinition, name: ' Lambing ' }, true],
  ['field bound', { ...templateDefinition, fields: Array(200).fill(field) }, true],
  ['field overflow', { ...templateDefinition, fields: Array(201).fill(field) }, false],
  ['empty fields', { ...templateDefinition, fields: [] }, false],
  ['missing envelope', {}, false],
  ['unknown envelope property', { ...templateDefinition, surprise: true }, false],
  ['unsupported schema', { ...templateDefinition, schema_version: 2 }, false],
  ['unsupported workflow', { ...templateDefinition, workflow: 'other' }, false],
  ['blank name', { ...templateDefinition, name: ' ' }, false],
  ['name bound', { ...templateDefinition, name: 'x'.repeat(80) }, true],
  ['name overflow', { ...templateDefinition, name: 'x'.repeat(81) }, false],
  ['key bound', withField({ key: 'x'.repeat(80) }), true],
  ['key overflow', withField({ key: 'x'.repeat(81) }), false],
  ['missing label', withField({ label: undefined }), false],
  ['label overflow', withField({ label: 'x'.repeat(81) }), false],
  ['unknown field property', withField({ extra: true }), false],
  ['invalid scope', withField({ scope: 'farm' }), false],
  ['invalid type', withField({ type: 'object' }), false],
  ['invalid unit', withField({ unit: 'stone' }), false],
  ['invalid required flag', withField({ required: 'true' }), false],
  ['invalid hidden flag', withField({ hidden: 1 }), false],
  ['today default', withField({ type: 'date', default: { kind: 'today' } }), true],
  ['today extra property', withField({ default: { kind: 'today', value: 'now' } }), false],
  ['unknown default kind', withField({ default: { kind: 'random' } }), false],
  ['missing literal value', withField({ default: { kind: 'literal' } }), false],
  ['literal object', withField({ default: { kind: 'literal', value: {} } }), false],
  [
    'literal extra property',
    withField({ default: { kind: 'literal', value: 1, extra: true } }),
    false,
  ],
  ['text bound', withField({ default: { kind: 'literal', value: 'x'.repeat(1000) } }), true],
  ['text overflow', withField({ default: { kind: 'literal', value: 'x'.repeat(1001) } }), false],
  [
    'boolean default',
    withField({ type: 'boolean', default: { kind: 'literal', value: false } }),
    true,
  ],
  ['number default', withField({ type: 'number', default: { kind: 'literal', value: 1.5 } }), true],
  ['null literal structure', withField({ default: { kind: 'literal', value: null } }), true],
  [
    'array literal structure',
    withField({ default: { kind: 'literal', value: ['x'.repeat(80)] } }),
    true,
  ],
  [
    'array literal overflow',
    withField({ default: { kind: 'literal', value: ['x'.repeat(81)] } }),
    false,
  ],
  ['choice bound', withField({ type: 'choice', choices: Array(50).fill(choice) }), true],
  ['choice overflow', withField({ type: 'choice', choices: Array(51).fill(choice) }), false],
  ['empty choices', withField({ type: 'choice', choices: [] }), false],
  ['choice missing label', withField({ type: 'choice', choices: [{ key: 'easy' }] }), false],
  [
    'choice extra property',
    withField({ type: 'choice', choices: [{ ...choice, extra: true }] }),
    false,
  ],
  [
    'choice key overflow',
    withField({ type: 'choice', choices: [{ ...choice, key: 'x'.repeat(81) }] }),
    false,
  ],
  [
    'choice label overflow',
    withField({ type: 'choice', choices: [{ ...choice, label: 'x'.repeat(81) }] }),
    false,
  ],
];
