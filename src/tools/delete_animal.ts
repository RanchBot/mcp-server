import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({
  animal_id: z.string(),
  farm_id: z.string().optional(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;

  if (!targetFarmId) {
    throw new Error('farm_id is required');
  }

  await client.deleteAnimal(targetFarmId, validated.animal_id);
  return {
    message: `Animal ${validated.animal_id} deleted successfully`,
  };
}
