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

  const result = await client.listAnimalIdentifiers(targetFarmId, validated.animal_id);
  return {
    ...result,
    message: `Found ${result.identifiers?.length || 0} identifier(s) for animal ${validated.animal_id}`,
  };
}
