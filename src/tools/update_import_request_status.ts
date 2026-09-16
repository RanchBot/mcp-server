import { RanchBotApiClient } from '../client';

export async function handleTool(client: RanchBotApiClient, _farmId: string, args: any) {
  if (!args?.import_request_id) {
    throw new Error('import_request_id is required');
  }
  if (!args?.status) {
    throw new Error('status is required (PROCESSING, COMPLETED, or FAILED)');
  }

  const result = await client.updateImportRequestStatus(args.import_request_id, {
    status: args.status,
    summary: args.summary,
  });

  return {
    ...result,
    message: `Import request marked ${args.status}`,
  };
}
