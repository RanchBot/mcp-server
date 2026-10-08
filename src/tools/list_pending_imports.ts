import { RanchBotApiClient } from '../client';
import { paginatedToolSchemas } from './_shared/listSchemas';

export async function handleTool(client: RanchBotApiClient, _farmId: string, args: any) {
  const input = paginatedToolSchemas.list_pending_imports.parse(args);
  const result = await client.listImportRequests({
    ...input,
    status: input.status ?? 'PENDING',
  });

  return {
    total: result.total,
    import_requests: result.import_requests,
    message: `Found ${result.total} import request(s)`,
  };
}
