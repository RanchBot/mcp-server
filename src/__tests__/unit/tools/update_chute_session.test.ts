import { createMockClient } from '../testUtils';
import { handleTool as updateChuteSession } from '../../../tools/update_chute_session';

const widgets = [{ id: 'weight', type: 'weight', label: 'Weight', options: { unit: 'kg' } }];

describe('update_chute_session tool', () => {
  it('replaces the widget grid on a proposed session', async () => {
    const client = createMockClient();
    client.updateChuteSession.mockResolvedValueOnce({
      id: 's1',
      name: 'Weigh Day',
      status: 'PROPOSED',
    } as any);

    const result = await updateChuteSession(client, 'farm-1', {
      session_id: 's1',
      widgets,
      record_type: 'OTHER',
    });

    expect(client.updateChuteSession).toHaveBeenCalledWith('farm-1', 's1', {
      name: undefined,
      config: { widgets, record_type: 'OTHER' },
      group_id: undefined,
    });
    expect(result.message).toContain('Updated proposed chute session');
  });

  it('renames without touching the config when no widgets are given', async () => {
    const client = createMockClient();
    client.updateChuteSession.mockResolvedValueOnce({ id: 's1', name: 'New name' } as any);

    await updateChuteSession(client, 'farm-1', { session_id: 's1', name: 'New name' });

    expect(client.updateChuteSession).toHaveBeenCalledWith('farm-1', 's1', {
      name: 'New name',
      config: undefined,
      group_id: undefined,
    });
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();
    await expect(
      updateChuteSession(client, '' as unknown as string, { session_id: 's1' }),
    ).rejects.toThrow('farm_id is required');
  });
});
