import { paginatedToolSchemas } from './_shared/listSchemas';
import { AnimalInventoryStatus, RanchBotApiClient } from '../client';

const argsSchema = paginatedToolSchemas.list_animals;

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;

  if (!targetFarmId) {
    throw new Error('farm_id is required');
  }

  const params: {
    skip?: number;
    take?: number;
    inventory_status?: AnimalInventoryStatus | 'ALL';
    query?: string;
    match_mode?: 'exact' | 'partial';
    identifier_type?: string;
  } = {};
  if (validated.skip !== undefined) {
    params.skip = validated.skip;
  }
  if (validated.take !== undefined) {
    params.take = validated.take;
  }

  if (validated.inventory_status !== undefined)
    params.inventory_status = validated.inventory_status;
  if (validated.query !== undefined) params.query = validated.query;
  if (validated.match_mode !== undefined) params.match_mode = validated.match_mode;
  if (validated.identifier_type !== undefined) params.identifier_type = validated.identifier_type;

  const result = await client.listAnimals(targetFarmId, params);
  return {
    ...result,
    message: `Found ${result.records?.length || 0} animal(s)`,
  };
}
