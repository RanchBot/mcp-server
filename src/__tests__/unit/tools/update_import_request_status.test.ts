import { createMockClient } from '../testUtils';
import { handleTool as updateImportRequestStatus } from '../../../tools/update_import_request_status';

describe('update_import_request_status tool', () => {
  it('updates status with a summary', async () => {
    const client = createMockClient();
    client.updateImportRequestStatus.mockResolvedValueOnce({
      import_request: { id: 'ir1', status: 'COMPLETED' },
    } as any);

    const result = await updateImportRequestStatus(client, '', {
      import_request_id: 'ir1',
      status: 'COMPLETED',
      summary: 'Loaded 42 ewes.',
    });

    expect(client.updateImportRequestStatus).toHaveBeenCalledWith('ir1', {
      status: 'COMPLETED',
      summary: 'Loaded 42 ewes.',
    });
    expect(result.message).toBe('Import request marked COMPLETED');
  });

  it('throws when status is missing', async () => {
    const client = createMockClient();

    await expect(
      updateImportRequestStatus(client, '', { import_request_id: 'ir1' }),
    ).rejects.toThrow('status is required');
  });
});
