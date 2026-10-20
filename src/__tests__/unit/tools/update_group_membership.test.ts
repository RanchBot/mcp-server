import { createMockClient } from '../testUtils';
import { handleTool as updateGroupMembership } from '../../../tools/update_group_membership';

const fingerprint = 'a'.repeat(64);

describe('update_group_membership tool', () => {
  it('forwards add/remove ids and the reviewed fingerprint', async () => {
    const client = createMockClient();
    client.updateGroupMembership.mockResolvedValueOnce({ added_animal_ids: [] } as any);

    await updateGroupMembership(client, 'farm-1', {
      group_id: 'g1',
      add_animal_ids: ['11111111-1111-4111-8111-111111111111'],
      remove_animal_ids: ['22222222-2222-4222-8222-222222222222'],
      membership_fingerprint: fingerprint,
    });

    expect(client.updateGroupMembership).toHaveBeenCalledWith('farm-1', 'g1', {
      add_animal_ids: ['11111111-1111-4111-8111-111111111111'],
      remove_animal_ids: ['22222222-2222-4222-8222-222222222222'],
      membership_fingerprint: fingerprint,
    });
  });

  it('rejects a malformed fingerprint before any request', async () => {
    const client = createMockClient();
    await expect(
      updateGroupMembership(client, 'farm-1', { group_id: 'g1', membership_fingerprint: 'nope' }),
    ).rejects.toThrow();
    expect(client.updateGroupMembership).not.toHaveBeenCalled();
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();
    await expect(
      updateGroupMembership(client, '' as unknown as string, {
        group_id: 'g1',
        membership_fingerprint: fingerprint,
      }),
    ).rejects.toThrow('farm_id is required');
  });
});
