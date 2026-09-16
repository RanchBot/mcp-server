import { RanchBotApiClient } from '../../../client';
import { getToolHandlerPath } from '../../../toolRegistry';
import { birthEventTools } from '../../../tools/birthEventTools';
import * as tools from '../../../tools/birthEventShared';
import { registerTools } from '../../../tools';

const farmId = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const input = {
  request_id: requestId,
  bundle: { dam_id: requestId, offspring: [{ review_label: 'Lamb 1', sex: 'male' }] },
};
const client = () =>
  Object.fromEntries(
    Object.keys(tools).map((name) => [
      name,
      jest.fn().mockResolvedValue({ request_id: requestId }),
    ]),
  ) as unknown as jest.Mocked<RanchBotApiClient>;

describe('birth event MCP tools', () => {
  it('registers a callable handler for every advertised birth operation', async () => {
    for (const tool of birthEventTools) {
      expect(registerTools()).toContainEqual(tool);
      expect(getToolHandlerPath(tool.name)).toBe(`./tools/${tool.name}.js`);
      const handler = await import(`../../../tools/${tool.name}`);
      expect(typeof handler.handleTool).toBe('function');
    }
  });
  it('previews without committing and forwards all structured fields', async () => {
    const api = client();
    await tools.previewBirthEvent(api, farmId, input);
    expect(api.previewBirthEvent).toHaveBeenCalledWith(farmId, input);
    expect(api.confirmBirthEvent).not.toHaveBeenCalled();
  });

  it('reads source evidence for the selected farm and rejects missing or malformed scope', async () => {
    const api = client();
    await tools.getBirthSourceEvidence(api, farmId, { source_sms_id: requestId });
    expect(api.getBirthSourceEvidence).toHaveBeenLastCalledWith(farmId, requestId);
    await tools.getBirthSourceEvidence(api, requestId, {
      farm_id: farmId,
      source_sms_id: requestId,
    });
    expect(api.getBirthSourceEvidence).toHaveBeenLastCalledWith(farmId, requestId);
    await expect(
      tools.getBirthSourceEvidence(api, '', { source_sms_id: requestId }),
    ).rejects.toThrow();
    await expect(
      tools.getBirthSourceEvidence(api, farmId, { source_sms_id: '../other' }),
    ).rejects.toThrow();
    await expect(
      tools.getBirthSourceEvidence(api, farmId, { source_sms_id: requestId, approve: true }),
    ).rejects.toThrow();
    expect(api.getBirthSourceEvidence).toHaveBeenCalledTimes(2);
    expect(api.confirmBirthEvent).not.toHaveBeenCalled();
    expect(
      birthEventTools.find((tool) => tool.name === 'get_birth_source_evidence')?.annotations
        ?.readOnlyHint,
    ).toBe(true);
  });

  it('requires the exact review hash and does not fetch a replacement preview', async () => {
    const api = client();
    await expect(tools.confirmBirthEvent(api, farmId, input)).rejects.toThrow();
    const confirmation = { ...input, confirmation_hash: 'a'.repeat(64) };
    await tools.confirmBirthEvent(api, 'another-farm', { ...confirmation, farm_id: farmId });
    expect(api.confirmBirthEvent).toHaveBeenCalledTimes(1);
    expect(api.confirmBirthEvent).toHaveBeenCalledWith(farmId, confirmation);
    expect(api.previewBirthEvent).not.toHaveBeenCalled();
  });

  it('rejects unknown confirmation arguments, missing farms, and unbounded lists', async () => {
    const api = client();
    await expect(
      tools.confirmBirthEvent(api, farmId, {
        ...input,
        confirmation_hash: 'a'.repeat(64),
        confirmed: true,
      }),
    ).rejects.toThrow();
    await expect(tools.previewBirthEvent(api, '', input)).rejects.toThrow();
    await expect(tools.listBirthEvents(api, farmId, { take: 201 })).rejects.toThrow();
    expect(api.confirmBirthEvent).not.toHaveBeenCalled();
  });

  it('keeps omitted task dates unchanged and passes an explicit null to clear them', async () => {
    const api = client();
    await tools.updateFarmTask(api, farmId, { task_id: requestId, status: 'DONE' });
    expect(api.updateFarmTask).toHaveBeenLastCalledWith(farmId, requestId, { status: 'DONE' });
    await tools.updateFarmTask(api, farmId, { task_id: requestId, status: 'TODO', due_date: null });
    expect(api.updateFarmTask).toHaveBeenLastCalledWith(farmId, requestId, {
      status: 'TODO',
      due_date: null,
    });
  });

  it('bounds task/protocol lists and requires protocol steps', async () => {
    const api = client();
    await tools.listFarmTasks(api, farmId, { status: 'TODO', take: 50 });
    await tools.listProtocolVersions(api, farmId, { skip: 10, take: 20 });
    expect(api.listFarmTasks).toHaveBeenCalledWith(farmId, { status: 'TODO', take: 50 });
    expect(api.listProtocolVersions).toHaveBeenCalledWith(farmId, { skip: 10, take: 20 });
    await expect(
      tools.createProtocolVersion(api, farmId, { name: 'Neonatal', version: '1', steps: [] }),
    ).rejects.toThrow();
  });

  it('publishes full birth fields and distinguishes preview from write tools', () => {
    const preview = birthEventTools.find((tool) => tool.name === 'preview_birth_event')!;
    const confirmation = birthEventTools.find((tool) => tool.name === 'confirm_birth_event')!;
    const schema = preview.inputSchema.properties?.bundle as any;
    expect(schema.properties).toEqual(
      expect.objectContaining({
        offspring: expect.any(Object),
        protocol: expect.any(Object),
        evidence: expect.any(Object),
        unresolved: expect.any(Object),
      }),
    );
    expect(preview.annotations?.readOnlyHint).toBe(true);
    expect(confirmation.annotations?.readOnlyHint).toBe(false);
    expect(confirmation.inputSchema.required).toContain('confirmation_hash');
  });
});
