import { createMockClient } from '../testUtils';
import { handleTool as createRation } from '../../../tools/create_ration';

describe('create_ration tool', () => {
  const args = {
    name: 'Finishing lambs',
    ingredients: [
      { name: 'Alfalfa hay', per_head_lbs: 3 },
      { name: 'Whole barley', per_head_lbs: 2 },
    ],
    assignments: [{ group_id: 'g1', feedings_per_day: 2, label: 'AM' }],
  };

  it('creates the ration and flags the in-app activation step', async () => {
    const client = createMockClient();
    client.createRation.mockResolvedValueOnce({
      id: 'r1',
      name: 'Finishing lambs',
      assignments: [{ id: 'a1', is_active: false }],
    } as any);

    const result = await createRation(client, 'farm-1', args);

    expect(client.createRation).toHaveBeenCalledWith('farm-1', {
      name: 'Finishing lambs',
      unit: undefined,
      ingredients: args.ingredients,
      assignments: args.assignments,
    });
    expect(result.ration.id).toBe('r1');
    expect(result.message).toContain('inactive until the user activates them');
  });

  it('omits the activation note when there are no assignments', async () => {
    const client = createMockClient();
    client.createRation.mockResolvedValueOnce({
      id: 'r1',
      name: 'Finishing lambs',
      assignments: [],
    } as any);

    const result = await createRation(client, 'farm-1', { ...args, assignments: undefined });

    expect(result.message).not.toContain('inactive');
  });

  it('rejects an empty ingredient list', async () => {
    const client = createMockClient();

    await expect(createRation(client, 'farm-1', { name: 'X', ingredients: [] })).rejects.toThrow();
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(createRation(client, '' as unknown as string, args)).rejects.toThrow(
      'farm_id is required',
    );
  });
});
