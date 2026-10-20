import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({
  animal_id: z.string(),
  include_saved_births: z.boolean().optional(),
  birth_skip: z.number().int().min(0).optional(),
  birth_take: z.number().int().min(1).max(200).optional(),
  farm_id: z.string().optional(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;

  if (!targetFarmId) {
    throw new Error('farm_id is required');
  }

  const params: { include_saved_births?: boolean; birth_skip?: number; birth_take?: number } = {};
  if (validated.include_saved_births !== undefined)
    params.include_saved_births = validated.include_saved_births;
  if (validated.birth_skip !== undefined) params.birth_skip = validated.birth_skip;
  if (validated.birth_take !== undefined) params.birth_take = validated.birth_take;

  const result = Object.keys(params).length
    ? await client.getAnimal(targetFarmId, validated.animal_id, params)
    : await client.getAnimal(targetFarmId, validated.animal_id);
  return result;
}
