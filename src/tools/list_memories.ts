import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({
  farm_id: z.string().optional(),
});

interface MemoryVersion {
  id: string;
  value: unknown;
  source: string | null;
  confidence: number | null;
  created_at: string;
  updated_at: string;
}

interface GroupedMemory {
  key: string;
  current: MemoryVersion | null;
  versions: MemoryVersion[];
}

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;

  if (!targetFarmId) {
    throw new Error('farm_id is required');
  }

  const result = await client.listMemories(targetFarmId);
  const grouped: GroupedMemory[] = result.memories ?? [];

  // Parity with the in-app agent: the current value per key. History is a UI concern.
  const memories = grouped.map((memory) => {
    const current = memory.current;
    return {
      key: memory.key,
      current: current ?? null,
      value: current?.value ?? null,
      source: current?.source ?? null,
      as_of: current?.created_at,
      version_count: memory.versions.length,
    };
  });

  return {
    memories,
    message: `Found ${memories.length} ${memories.length === 1 ? 'memory' : 'memories'}`,
  };
}
