import { RanchBotApiClient } from '../../../client';
import { getToolHandlerPath } from '../../../toolRegistry';
import { registerTools } from '../../../tools';
import { workflowTools } from '../../../tools/workflowTools';
import * as tools from '../../../tools/workflowShared';

const farmId = '11111111-1111-4111-8111-111111111111';
const previewId = '22222222-2222-4222-8222-222222222222';
const templateId = '33333333-3333-4333-8333-333333333333';
const requestId = '44444444-4444-4444-8444-444444444444';
const otherFarmId = '99999999-9999-4999-8999-999999999999';
const client = () =>
  Object.fromEntries(
    Object.keys(tools).map((name) => [name, jest.fn().mockResolvedValue({})]),
  ) as unknown as jest.Mocked<RanchBotApiClient>;

describe('workflow MCP tools', () => {
  it('registers a callable handler for every advertised workflow operation', async () => {
    for (const tool of workflowTools) {
      expect(registerTools()).toContainEqual({
        ...tool,
        description: expect.stringContaining(tool.description!),
      });
      expect(getToolHandlerPath(tool.name)).toBe(`./tools/${tool.name}.js`);
      const handler = await import(`../../../tools/${tool.name}`);
      expect(typeof handler.handleTool).toBe('function');
    }
  });

  it('forwards a preview and preserves the frozen review and proposed bundle', async () => {
    const api = client();
    const response = {
      preview_id: previewId,
      review: { dam: { id: farmId }, identifier_warnings: ['EID 1 exists'] },
      proposed_changes: { bundle: { dam_id: farmId } },
    };
    (api.previewWorkflow as jest.Mock).mockResolvedValue(response);
    const input = {
      request_id: requestId,
      template_id: templateId,
      inputs: { event: { dam_id: farmId }, offspring: [] },
    };
    const result = await tools.previewWorkflow(api, farmId, input);
    expect(api.previewWorkflow).toHaveBeenCalledWith(farmId, input);
    expect(result).toEqual(response);
    expect(api.commitWorkflow).not.toHaveBeenCalled();
  });

  it('reads a preview without creating one and preserves review and bundle', async () => {
    const api = client();
    const response = {
      preview_id: previewId,
      review: null,
      proposed_changes: { bundle: { dam_id: farmId } },
    };
    (api.getWorkflowPreview as jest.Mock).mockResolvedValue(response);
    const result = await tools.getWorkflowPreview(api, farmId, { preview_id: previewId });
    expect(api.getWorkflowPreview).toHaveBeenCalledWith(farmId, previewId);
    expect(result).toEqual(response);
    expect(api.previewWorkflow).not.toHaveBeenCalled();
  });

  it('requires the exact approval and never fetches a replacement preview', async () => {
    const api = client();
    await expect(tools.commitWorkflow(api, farmId, { preview_id: previewId })).rejects.toThrow();
    await expect(
      tools.commitWorkflow(api, farmId, {
        preview_id: previewId,
        approval: { confirmed: true, preview_hash: 'not-a-hash' },
      }),
    ).rejects.toThrow();
    const approval = { confirmed: true, preview_hash: 'a'.repeat(64) };
    await tools.commitWorkflow(api, otherFarmId, { preview_id: previewId, approval });
    expect(api.commitWorkflow).toHaveBeenCalledTimes(1);
    expect(api.commitWorkflow).toHaveBeenCalledWith(otherFarmId, previewId, { approval });
    expect(api.previewWorkflow).not.toHaveBeenCalled();
  });

  it('rejects unexpected preview arguments and missing farms', async () => {
    const api = client();
    await expect(
      tools.previewWorkflow(api, farmId, {
        request_id: requestId,
        template_id: templateId,
        inputs: { event: {}, offspring: [] },
        approve: true,
      }),
    ).rejects.toThrow();
    await expect(tools.getWorkflowPreview(api, '', { preview_id: previewId })).rejects.toThrow();
    expect(api.previewWorkflow).not.toHaveBeenCalled();
    expect(api.getWorkflowPreview).not.toHaveBeenCalled();
  });
});
