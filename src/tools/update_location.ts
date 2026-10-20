import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({
  farm_id: z.string().optional(),
  location_id: z.string(),
  name: z.string().optional(),
  parent_id: z.string().nullable().optional(),
  category: z
    .enum(['FARM', 'FIELD', 'PEN', 'BARN', 'VET', 'RODEO', 'ABATTOIR', 'AUCTION', 'OTHER'])
    .nullable()
    .optional(),
  context: z.enum(['OPERATED', 'LEASED', 'EXTERNAL']).nullable().optional(),
  address: z.string().nullable().optional(),
  legal_land_description: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  province_state: z.string().nullable().optional(),
  expected_version: z.number().int().optional(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;
  if (!targetFarmId) throw new Error('farm_id is required');
  const { farm_id: _farm, location_id, ...data } = validated;
  const result = await client.updateLocation(targetFarmId, location_id, data);
  return { ...result, message: `Location ${location_id} updated` };
}
