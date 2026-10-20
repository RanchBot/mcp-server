import { createMockClient } from '../testUtils';
import { handleTool as getAnimal } from '../../../tools/get_animal';

describe('get_animal tool', () => {
  it('gets animal by id', async () => {
    const client = createMockClient();
    client.getAnimal.mockResolvedValueOnce({ id: 'a1' } as any);

    const result = await getAnimal(client, 'farm-1', { animal_id: 'a1' });

    expect(client.getAnimal).toHaveBeenCalledWith('farm-1', 'a1');
    expect(result).toEqual({ id: 'a1' });
  });

  it('passes the read-only birth_facts projection through unchanged', async () => {
    const client = createMockClient();
    const birth_facts = {
      record: null,
      derived: { birth_date: null, time_precision: null, dam_id: null, sire: null },
      profile_birth_date: null,
      effective_birth_date: null,
      conflicts: [],
    };
    client.getAnimal.mockResolvedValueOnce({ id: 'a1', birth_facts } as any);

    const result = await getAnimal(client, 'farm-1', { animal_id: 'a1' });

    expect(result).toEqual({ id: 'a1', birth_facts });
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(getAnimal(client, '' as unknown as string, { animal_id: 'a1' })).rejects.toThrow(
      'farm_id is required',
    );
  });

  it('forwards saved-birth expansion params only when requested', async () => {
    const client = createMockClient();
    client.getAnimal.mockResolvedValueOnce({ id: 'a1' } as any);

    await getAnimal(client, 'farm-1', {
      animal_id: 'a1',
      include_saved_births: true,
      birth_skip: 10,
      birth_take: 25,
    });

    expect(client.getAnimal).toHaveBeenCalledWith('farm-1', 'a1', {
      include_saved_births: true,
      birth_skip: 10,
      birth_take: 25,
    });
  });
});
