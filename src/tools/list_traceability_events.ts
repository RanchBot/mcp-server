import { RanchBotApiClient } from '../client';
import { paginatedToolSchemas } from './_shared/listSchemas';

const argsSchema = paginatedToolSchemas.list_traceability_events;

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;
  if (!targetFarmId) throw new Error('farm_id is required');
  const { farm_id: _farm, ...params } = validated;
  const result = await client.listTraceabilityEvents(targetFarmId, params);
  return { ...result, message: `Found ${result.events?.length || 0} event(s)` };
}
