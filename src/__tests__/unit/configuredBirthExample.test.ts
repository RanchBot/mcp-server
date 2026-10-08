import { createRequire } from 'module';

const requireExample = createRequire(__filename);
const { runConfiguredBirth, requireLoopback } = requireExample(
  '../../../docs/examples/configured-birth.cjs',
);
const { configuredDefinition, birthInputs } = requireExample(
  '../../../docs/examples/birthPayloads.cjs',
);
const input = {
  disposable: true,
  farmId: '11111111-1111-4111-8111-111111111111',
  damId: '22222222-2222-4222-8222-222222222222',
  groupId: '33333333-3333-4333-8333-333333333333',
  date: '2026-10-01',
  tag: '0042',
  notes: 'Bottle lamb',
  name: 'Example lambing',
  unit: 'kg',
  ease: 'unassisted',
};

const fixture = (mode = 'normal') => {
  const bundle = { custom: { lambing_ease: 'unassisted' }, offspring: [{ sex: 'female' }] };
  const preview = {
    preview_id: 'preview',
    template_id: 'template',
    template_version: 2,
    status: 'pending',
    preview_hash: 'a'.repeat(64),
    resolved_values: { event: { lambing_ease: 'unassisted' } },
    default_sources: { event: { lambing_ease: 'literal' } },
    validation_issues: [],
    review: { dam: { id: input.damId } },
    proposed_changes: { bundle },
  };
  const birth = {
    id: 'birth',
    record_id: 'record',
    workflow_template_id: 'template',
    workflow_template_version_id: 'v2',
    bundle: { input: bundle },
    offspring: [{ animal_id: 'lamb' }],
  };
  const saved = {
    preview_id: 'preview',
    status: 'committed',
    saved_entity_ids: { birth_event_id: 'birth' },
    outcome: birth,
  };
  let committed = false;
  const call = jest.fn(async (name: string, args: any) => {
    switch (name) {
      case 'list_my_farms':
        return { farms: [{ id: input.farmId, species: 'SHEEP' }] };
      case 'get_animal':
        return { id: args.animal_id };
      case 'get_group':
        return { id: input.groupId };
      case 'list_workflow_templates':
        return { total: 1, records: [{ id: 'starter', name: 'Detailed lambing' }] };
      case 'get_workflow_template':
        return { current_version: { definition: { schema_version: 1, workflow: 'record_birth' } } };
      case 'create_workflow_template':
        return { id: 'template', current_version: { id: 'v1', version: 1 } };
      case 'publish_workflow_template_version':
        return { id: 'template', current_version: { id: 'v2', version: 2 } };
      case 'preview_workflow':
        return mode === 'invalid' ? { ...preview, status: 'invalid' } : preview;
      case 'get_workflow_preview':
        return committed
          ? { ...preview, ...saved }
          : mode === 'changed'
            ? { ...preview, preview_hash: 'b'.repeat(64) }
            : preview;
      case 'commit_workflow':
        if (mode !== 'pending') committed = true;
        if (mode === 'lost' || mode === 'pending') throw new Error('Uncertain response');
        return saved;
      case 'get_birth_event':
        return birth;
      case 'get_record':
        return { id: 'record' };
      default:
        throw new Error(`Unexpected tool ${name}`);
    }
  });
  return { call, preview, saved };
};

it('uses the tested literal field keys, labels, defaults and units without altering the starter', () => {
  const starter = {
    schema_version: 1,
    workflow: 'record_birth',
    name: 'Detailed lambing',
    fields: [],
  };
  const definition = configuredDefinition(starter, input);
  expect(starter.fields).toEqual([]);
  expect(definition.fields).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ key: 'offspring.birth_weight', unit: 'kg' }),
      expect.objectContaining({
        key: 'lambing_ease',
        default: { kind: 'literal', value: 'unassisted' },
      }),
    ]),
  );
  expect(birthInputs(input)).toMatchObject({
    event: { dam_id: input.damId },
    offspring: [
      {
        'offspring.identifiers': [{ type: 'MANAGEMENT_TAG', value: '0042' }],
        'offspring.fostering_notes': 'Bottle lamb',
      },
    ],
  });
});

it.each(['configuration', 'birth'])('does not save unapproved %s', async (stop) => {
  const { call } = fixture();
  await expect(
    runConfiguredBirth({ call, input, approve: async (stage: string) => stage !== stop }),
  ).rejects.toThrow(/cancelled/);
  expect(call.mock.calls.filter(([name]) => name === 'commit_workflow')).toHaveLength(0);
  expect(call.mock.calls.filter(([name]) => name === 'create_workflow_template')).toHaveLength(
    stop === 'configuration' ? 0 : 1,
  );
});

it('reviews the full preview and commits only its matching hash before saved-record reads', async () => {
  const { call, preview, saved } = fixture();
  const approve = jest.fn().mockResolvedValue(true);
  const result = await runConfiguredBirth({ call, input, approve });
  expect(approve).toHaveBeenNthCalledWith(2, 'birth', expect.objectContaining({ preview }));
  expect(result.saved).toEqual(saved);
  expect(call).toHaveBeenCalledWith('commit_workflow', {
    farm_id: input.farmId,
    preview_id: preview.preview_id,
    approval: { confirmed: true, preview_hash: preview.preview_hash },
  });
  for (const [name, args] of call.mock.calls)
    if (name !== 'list_my_farms') expect(args.farm_id).toBe(input.farmId);
});

it.each(['invalid', 'changed'])('does not commit an %s preview', async (mode) => {
  const { call } = fixture(mode);
  await expect(runConfiguredBirth({ call, input, approve: async () => true })).rejects.toThrow(
    /Preview/,
  );
  expect(call.mock.calls.filter(([name]) => name === 'commit_workflow')).toHaveLength(0);
});

it.each(['lost', 'pending'])(
  'reads after an uncertain commit (%s), never committing twice or re-previewing',
  async (mode) => {
    const { call, saved } = fixture(mode);
    const run = runConfiguredBirth({ call, input, approve: async () => true });
    if (mode === 'lost') expect((await run).saved).toEqual(saved);
    else await expect(run).rejects.toThrow('Commit not verified');
    expect(call.mock.calls.filter(([name]) => name === 'commit_workflow')).toHaveLength(1);
    expect(call.mock.calls.filter(([name]) => name === 'preview_workflow')).toHaveLength(1);
    expect(call.mock.calls.filter(([name]) => name === 'get_workflow_preview')).toHaveLength(2);
  },
);

it.each([
  'https://api.ranch.bot',
  'http://localhost.example.test',
  'file:///tmp/api',
  'http://user:pass@localhost',
  'http://localhost/path',
])('refuses non-loopback or credential-bearing origin %s', (origin) => {
  expect(() => requireLoopback(origin)).toThrow();
});
it('accepts an explicit loopback test origin and rejects non-disposable input before calls', async () => {
  expect(requireLoopback('http://127.0.0.1:7004')).toBe('http://127.0.0.1:7004');
  const call = jest.fn();
  await expect(
    runConfiguredBirth({ call, input: { ...input, disposable: false }, approve: async () => true }),
  ).rejects.toThrow();
  expect(call).not.toHaveBeenCalled();
});
