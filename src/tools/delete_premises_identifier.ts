import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({
  farm_id: z.string().optional(),
  location_id: z.string(),
  identifier_id: z.string(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;
  if (!targetFarmId) throw new Error('farm_id is required');
  await client.deletePremisesIdentifier(
    targetFarmId,
    validated.location_id,
    validated.identifier_id,
  );
  return {
    deleted: true,
    id: validated.identifier_id,
    message: `Premises identifier ${validated.identifier_id} removed`,
  };
}
