import { createMockClient } from '../testUtils';
import { handleTool as listMemories } from '../../../tools/list_memories';

describe('list_memories tool', () => {
  it('lists the current value per key with version count', async () => {
    const client = createMockClient();
    client.listMemories.mockResolvedValueOnce({
      memories: [
        {
          key: 'operation.weaning_age',
          current: {
            id: 'manual',
            value: 'Protected manual value',
            source: 'user_edit',
            created_at: '2020-01-01T00:00:00Z',
          },
          versions: [
            {
              id: 'm2',
              value: 'We wean at 7 months now.',
              source: 'explicit',
              confidence: 1.0,
              created_at: '2026-06-01T00:00:00Z',
              updated_at: '2026-06-01T00:00:00Z',
            },
            {
              id: 'm1',
              value: 'We wean at 10 months.',
              source: 'explicit',
              confidence: 1.0,
              created_at: '2026-01-05T00:00:00Z',
              updated_at: '2026-01-05T00:00:00Z',
            },
          ],
        },
      ],
    } as any);

    const result = await listMemories(client, 'farm-1', {});

    expect(client.listMemories).toHaveBeenCalledWith('farm-1');
    expect(result).toEqual({
      memories: [
        {
          key: 'operation.weaning_age',
          current: {
            id: 'manual',
            value: 'Protected manual value',
            source: 'user_edit',
            created_at: '2020-01-01T00:00:00Z',
          },
          value: 'Protected manual value',
          source: 'user_edit',
          as_of: '2020-01-01T00:00:00Z',
          version_count: 2,
        },
      ],
      message: 'Found 1 memory',
    });
  });

  it('returns an empty list when nothing is remembered', async () => {
    const client = createMockClient();
    client.listMemories.mockResolvedValueOnce({ memories: [] } as any);

    const result = await listMemories(client, 'farm-1', {});

    expect(result).toEqual({ memories: [], message: 'Found 0 memories' });
  });

  it('prefers an explicit farm_id argument over the default', async () => {
    const client = createMockClient();
    client.listMemories.mockResolvedValueOnce({ memories: [] } as any);

    await listMemories(client, 'farm-1', { farm_id: 'farm-2' });

    expect(client.listMemories).toHaveBeenCalledWith('farm-2');
  });

  it('throws when farm id is missing', async () => {
    const client = createMockClient();

    await expect(listMemories(client, '' as unknown as string, {})).rejects.toThrow(
      'farm_id is required',
    );
  });
  it('does not fall back to excluded historical values', async () => {
    const client = createMockClient();
    client.listMemories.mockResolvedValueOnce({
      memories: [{ key: 'legacy.bad', current: null, versions: [{ value: 'poison' }] }],
    } as any);
    const result = await listMemories(client, 'farm-1', {});
    expect(result.memories[0]).toMatchObject({ current: null, value: null });
  });
});
