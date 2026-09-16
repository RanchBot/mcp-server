import { createMockClient } from '../testUtils';
import { handleTool as listPendingImports } from '../../../tools/list_pending_imports';

describe('list_pending_imports tool', () => {
  it('lists pending import requests by default', async () => {
    const client = createMockClient();
    client.listImportRequests.mockResolvedValueOnce({
      total: 1,
      import_requests: [{ id: 'ir1', status: 'PENDING' }],
    } as any);

    const result = await listPendingImports(client, '', {});

    expect(client.listImportRequests).toHaveBeenCalledWith({
      status: 'PENDING',
      skip: undefined,
      take: undefined,
    });
    expect(result.total).toBe(1);
    expect(result.message).toBe('Found 1 import request(s)');
  });

  it('passes an explicit status filter through', async () => {
    const client = createMockClient();
    client.listImportRequests.mockResolvedValueOnce({ total: 0, import_requests: [] } as any);

    await listPendingImports(client, '', { status: 'COMPLETED', skip: 5, take: 10 });

    expect(client.listImportRequests).toHaveBeenCalledWith({
      status: 'COMPLETED',
      skip: 5,
      take: 10,
    });
  });
});
