import { RanchBotApiClient } from '../client';
import { recentTransportSuggestionsSchema } from './_shared/listSchemas';

const argsSchema = recentTransportSuggestionsSchema;

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;
  if (!targetFarmId) throw new Error('farm_id is required');
  const params: { take?: number } = {};
  if (validated.take !== undefined) params.take = validated.take;
  return client.recentTransportSuggestions(targetFarmId, params);
}
