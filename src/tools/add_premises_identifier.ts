import { z } from 'zod';
import { RanchBotApiClient } from '../client';

const argsSchema = z.object({
  farm_id: z.string().optional(),
  location_id: z.string(),
  scheme: z.string(),
  scheme_label: z.string().nullable().optional(),
  issuer: z.string().nullable().optional(),
  jurisdiction: z.string().nullable().optional(),
  value: z.string(),
  source: z.string().nullable().optional(),
  confirmed: z.boolean().optional(),
  is_preferred: z.boolean().optional(),
});

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;
  if (!targetFarmId) throw new Error('farm_id is required');
  const { farm_id: _farm, location_id, ...data } = validated;
  const result = await client.addPremisesIdentifier(targetFarmId, location_id, data as any);
  return { ...result, message: `Premises identifier added to ${location_id}` };
}
