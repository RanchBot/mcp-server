import { generatedCrudTools } from '../../../generated/toolContracts';
import { createMockClient } from '../testUtils';
import { handleTool as createRecord } from '../../../tools/create_record';

describe('create_record tool', () => {
  it('creates record with all fields', async () => {
    const client = createMockClient();
    client.createRecord.mockResolvedValueOnce({ id: 'r1' } as any);

    const result = await createRecord(client, 'farm-1', {
      applied_at: '2024-01-01T00:00:00Z',
      name: 'Record',
      type: 'HEALTH',
      description: 'desc',
      animal_ids: ['a1'],
      group_ids: ['g1'],
    });

    expect(client.createRecord).toHaveBeenCalledWith('farm-1', {
      applied_at: '2024-01-01T00:00:00Z',
      name: 'Record',
      type: 'HEALTH',
      description: 'desc',
      animal_ids: ['a1'],
      group_ids: ['g1'],
    });
    expect(result).toEqual({
      id: 'r1',
      message: 'Record created successfully with ID: r1',
    });
  });

  it('publishes the breeding/exposure GENETIC guidance in the generated contract', () => {
    const tool = generatedCrudTools.find((candidate) => candidate.name === 'create_record')!;
    expect(tool.description).toMatch(/turnout, mating, breeding or exposure observation/i);
    expect(tool.description).toMatch(/ram joining a ewe is a GENETIC record/i);
    expect(tool.description).toMatch(/ewe lambing twins is a propose_birth_event bundle/i);
    expect(tool.inputSchema.properties!.type).toMatchObject({
      description: expect.stringMatching(/Use GENETIC for turnout, mating, breeding or exposure/),
    });
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(
      createRecord(client, '' as unknown as string, {
        applied_at: '2024-01-01T00:00:00Z',
        name: 'Record',
        type: 'HEALTH',
      }),
    ).rejects.toThrow('farm_id is required');
  });
});
