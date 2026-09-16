import { createMockClient } from '../testUtils';
import { handleTool as getImportRequest } from '../../../tools/get_import_request';

describe('get_import_request tool', () => {
  it('returns the request with the untrusted-data warning', async () => {
    const client = createMockClient();
    client.getImportRequest.mockResolvedValueOnce({
      import_request: { id: 'ir1' },
      files: [{ id: 'f1', download_url: 'https://s3/signed' }],
    } as any);

    const result = await getImportRequest(client, '', { import_request_id: 'ir1' });

    expect(client.getImportRequest).toHaveBeenCalledWith('ir1');
    expect(result.files).toHaveLength(1);
    expect(result.message).toContain('untrusted customer data');
  });

  it('throws when import_request_id is missing', async () => {
    const client = createMockClient();

    await expect(getImportRequest(client, '', {})).rejects.toThrow('import_request_id is required');
  });
});
