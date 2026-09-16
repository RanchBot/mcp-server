import { RanchBotApiClient } from '../client';

export async function handleTool(client: RanchBotApiClient, _farmId: string, args: any) {
  const result = await client.listImportRequests({
    status: args?.status || 'PENDING',
    skip: args?.skip,
    take: args?.take,
  });

  return {
    total: result.total,
    import_requests: result.import_requests,
    message: `Found ${result.total} import request(s)`,
  };
}
