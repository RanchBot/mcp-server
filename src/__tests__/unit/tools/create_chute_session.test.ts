import { createMockClient } from '../testUtils';
import { handleTool as createChuteSession } from '../../../tools/create_chute_session';

const widgets = [
  { id: 'bcs', type: 'score', label: 'BCS', size: 'half', options: { min: 1, max: 5 } },
  { id: 'trimmed', type: 'boolean', label: 'Feet trimmed', size: 'half' },
];

describe('create_chute_session tool', () => {
  it('proposes a session with the widget grid', async () => {
    const client = createMockClient();
    client.createChuteSession.mockResolvedValueOnce({
      id: 's1',
      name: 'BCS Day',
      status: 'PROPOSED',
    } as any);

    const result = await createChuteSession(client, 'farm-1', {
      name: 'BCS Day',
      widgets,
      record_type: 'HEALTH',
    });

    expect(client.createChuteSession).toHaveBeenCalledWith('farm-1', {
      name: 'BCS Day',
      config: { widgets, new_animal_fields: undefined, record_type: 'HEALTH' },
      group_id: undefined,
    });
    expect(result.status).toBe('PROPOSED');
    expect(result.message).toContain('Proposed chute session "BCS Day"');
  });

  it('resolves an existing group by name (case-insensitive)', async () => {
    const client = createMockClient();
    client.listGroups.mockResolvedValueOnce({
      records: [{ id: 'group-1', name: 'Weaners 2026' }],
    } as any);
    client.createChuteSession.mockResolvedValueOnce({ id: 's1', name: 'X' } as any);

    await createChuteSession(client, 'farm-1', { widgets, group_name: 'weaners 2026' });

    expect(client.createGroup).not.toHaveBeenCalled();
    expect(client.createChuteSession).toHaveBeenCalledWith(
      'farm-1',
      expect.objectContaining({ group_id: 'group-1' }),
    );
  });

  it('creates the group when it does not exist', async () => {
    const client = createMockClient();
    client.listGroups.mockResolvedValueOnce({ records: [] } as any);
    client.createGroup.mockResolvedValueOnce({ id: 'group-new', name: 'Culls' } as any);
    client.createChuteSession.mockResolvedValueOnce({ id: 's1', name: 'X' } as any);

    await createChuteSession(client, 'farm-1', { widgets, group_name: 'Culls' });

    expect(client.createGroup).toHaveBeenCalledWith('farm-1', { name: 'Culls' });
    expect(client.createChuteSession).toHaveBeenCalledWith(
      'farm-1',
      expect.objectContaining({ group_id: 'group-new' }),
    );
  });

  it('rejects an empty widget list and a missing farm', async () => {
    const client = createMockClient();
    await expect(createChuteSession(client, 'farm-1', { widgets: [] })).rejects.toThrow();
    await expect(createChuteSession(client, '' as unknown as string, { widgets })).rejects.toThrow(
      'farm_id is required',
    );
  });
});
