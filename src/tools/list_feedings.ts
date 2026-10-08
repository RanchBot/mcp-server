import { paginatedToolSchemas } from './_shared/listSchemas';
import { RanchBotApiClient } from '../client';

const argsSchema = paginatedToolSchemas.list_feedings;

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;

  if (!targetFarmId) {
    throw new Error('farm_id is required');
  }

  const params: { skip?: number; take?: number; status?: string; since?: string } = {};
  if (validated.skip !== undefined) {
    params.skip = validated.skip;
  }
  if (validated.take !== undefined) {
    params.take = validated.take;
  }
  if (validated.status) {
    params.status = validated.status;
  }
  if (validated.since) {
    params.since = validated.since;
  }

  const result = await client.listFeedings(targetFarmId, params);
  return {
    ...result,
    message: `Found ${result.records?.length || 0} feeding(s)`,
  };
}
