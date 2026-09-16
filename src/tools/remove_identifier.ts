import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({
  animal_id: z.string(),
  farm_id: z.string().optional(),
  identifier_id: z.string(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;

  if (!targetFarmId) {
    throw new Error('farm_id is required');
  }

  await client.removeAnimalIdentifier(targetFarmId, validated.animal_id, validated.identifier_id);
  return {
    message: `Identifier ${validated.identifier_id} removed from animal ${validated.animal_id}`,
  };
}
