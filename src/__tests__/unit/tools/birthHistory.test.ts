import { RanchBotApiClient } from '../../../client';
import { getToolHandler } from '../../../toolRegistry';
import { registerTools } from '../../../tools';
import * as handlers from '../../../tools/_shared/birthHistoryShared';
import { birthHistoryTools } from '../../../tools/_shared/birthHistoryTools';
import { withReadableTitle } from '../../../tools/toolPresentation';

const farmId = '11111111-1111-4111-8111-111111111111';
const damId = '22222222-2222-4222-8222-222222222222';
/** Each per-tool module re-exports the shared implementation, so identity is preserved. */
const historyHandlerByName: Record<string, unknown> = {
  get_birth_history_settings: handlers.getBirthHistorySettings,
  set_birth_history_settings: handlers.setBirthHistorySettings,
  get_birth_history_evidence: handlers.getBirthHistoryEvidence,
};
it('registers callable history tools with an explicit settings schema and correct write annotation', () => {
  for (const tool of birthHistoryTools) {
    expect(registerTools()).toContainEqual(
      withReadableTitle({
        ...tool,
        description: expect.stringContaining(tool.description!),
      }),
    );
    const handler = getToolHandler(tool.name);
    expect(handler).toBe(historyHandlerByName[tool.name]);
    expect(typeof handler).toBe('function');
    expect(tool.annotations?.readOnlyHint).toBe(tool.name !== 'set_birth_history_settings');
  }
  const schema = birthHistoryTools.find((tool) => tool.name === 'set_birth_history_settings')!
    .inputSchema.properties?.settings as any;
  expect(schema.properties).toHaveProperty('gestation_days');
  expect(schema.properties.birth_windows.maxItems).toBe(40);
});
it('forwards the requested farm/dam/date without selecting parentage or inventing settings', async () => {
  const api = {
    getBirthHistoryEvidence: jest.fn(),
    setBirthHistorySettings: jest.fn(),
    getBirthHistorySettings: jest.fn(),
  } as unknown as jest.Mocked<RanchBotApiClient>;
  await handlers.getBirthHistoryEvidence(api, '', {
    farm_id: farmId,
    dam_id: damId,
    birth_date: '2026-09-04',
  });
  expect(api.getBirthHistoryEvidence).toHaveBeenCalledWith(farmId, {
    dam_id: damId,
    birth_date: '2026-09-04',
  });
  expect(api.setBirthHistorySettings).not.toHaveBeenCalled();
  const settings = { version: 1, species: 'SHEEP', birth_windows: [] };
  await handlers.setBirthHistorySettings(api, farmId, { settings });
  expect(api.setBirthHistorySettings).toHaveBeenCalledWith(farmId, settings);
  await expect(
    handlers.getBirthHistoryEvidence(api, farmId, {
      dam_id: damId,
      birth_date: '2026-09-04',
      select_sire: true,
    }),
  ).rejects.toThrow();
});
