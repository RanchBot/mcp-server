import { paginatedToolSchemas } from './_shared/listSchemas';
import { RanchBotApiClient } from '../client';

const argsSchema = paginatedToolSchemas.list_records;

export async function handleTool(client: RanchBotApiClient, farmId: string, args: any) {
  const validated = argsSchema.parse(args);
  const targetFarmId = validated.farm_id || farmId;

  if (!targetFarmId) {
    throw new Error('farm_id is required');
  }

  const params: {
    skip?: number;
    take?: number;
    type?: string;
    animal_id?: string;
    group_id?: string;
    include_group_context?: boolean;
    applied_from?: string;
    applied_before?: string;
  } = {};
  if (validated.skip !== undefined) {
    params.skip = validated.skip;
  }
  if (validated.take !== undefined) {
    params.take = validated.take;
  }
  if (validated.type) {
    params.type = validated.type;
  }
  if (validated.animal_id !== undefined) params.animal_id = validated.animal_id;
  if (validated.group_id !== undefined) params.group_id = validated.group_id;
  if (validated.include_group_context !== undefined)
    params.include_group_context = validated.include_group_context;
  if (validated.applied_from !== undefined) params.applied_from = validated.applied_from;
  if (validated.applied_before !== undefined) params.applied_before = validated.applied_before;

  const result = await client.listRecords(targetFarmId, params);
  return {
    ...result,
    message: `Found ${result.records?.length || 0} record(s)`,
  };
}
