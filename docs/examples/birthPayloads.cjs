// Shared by the runnable example and installed-package acceptance.
const configuredDefinition = (starter, { name, unit, ease }) => ({
  ...starter,
  name,
  fields: [
    { key: 'dam_id', scope: 'event', label: 'Ewe' },
    { key: 'birth_date', scope: 'event', label: 'Lambing date' },
    { key: 'groups', scope: 'event', label: 'Pen', required: false },
    { key: 'offspring.sex', scope: 'offspring', label: 'Sex' },
    { key: 'offspring.identifiers', scope: 'offspring', label: 'Tag', required: false },
    {
      key: 'offspring.birth_weight',
      scope: 'offspring',
      label: 'Weight',
      unit,
      required: false,
    },
    {
      key: 'lambing_ease',
      scope: 'event',
      label: 'Lambing ease',
      type: 'choice',
      default: { kind: 'literal', value: ease },
      choices: [
        { key: 'unassisted', label: 'Unassisted' },
        { key: 'assisted', label: 'Assisted' },
      ],
    },
    {
      key: 'offspring.fostering_notes',
      scope: 'offspring',
      label: 'Fostering notes',
      type: 'text',
      required: false,
    },
  ],
});

const birthInputs = ({ damId, groupId, date, tag, notes }) => ({
  event: { dam_id: damId, birth_date: date, groups: [groupId] },
  offspring: [
    {
      'offspring.sex': 'female',
      'offspring.birth_weight': 4.2,
      'offspring.identifiers': [{ type: 'MANAGEMENT_TAG', value: tag }],
      'offspring.fostering_notes': notes,
    },
  ],
});

module.exports = { configuredDefinition, birthInputs };
