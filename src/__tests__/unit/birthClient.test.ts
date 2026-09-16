import axios from 'axios';
import { RanchBotApiClient } from '../../client';

jest.mock('axios');
const farmId = '11111111-1111-4111-8111-111111111111';

describe('birth event HTTP client', () => {
  const http = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() };
  beforeEach(() => {
    jest.clearAllMocks();
    for (const fn of Object.values(http)) fn.mockResolvedValue({ data: { accepted: true } });
    (axios.create as jest.Mock).mockReturnValue(http);
  });

  const makeClient = () => new RanchBotApiClient({ accessToken: 'synthetic-token' });

  it('propagates HTTP 409 for protected record updates and deletes', async () => {
    const client = makeClient();
    const conflict = {
      response: {
        status: 409,
        data: {
          message: 'Confirmed birth records and care cannot be edited or deleted individually',
        },
      },
    };
    http.put.mockRejectedValueOnce(conflict);
    await expect(client.updateRecord(farmId, farmId, { description: 'Changed' })).rejects.toBe(
      conflict,
    );
    http.delete.mockRejectedValueOnce(conflict);
    await expect(client.deleteRecord(farmId, farmId)).rejects.toBe(conflict);
  });

  it('uses separate preview and confirmation routes and preserves the reviewed payload', async () => {
    const client = makeClient();
    const request = { request_id: farmId, bundle: { offspring: [{ review_label: 'Lamb 1' }] } };
    const confirmation = { ...request, confirmation_hash: 'a'.repeat(64) };
    await client.previewBirthEvent(farmId, request);
    expect(http.post).toHaveBeenLastCalledWith(`/farm/${farmId}/birth-events/preview`, request);
    await client.confirmBirthEvent(farmId, confirmation);
    expect(http.post).toHaveBeenLastCalledWith(`/farm/${farmId}/birth-events`, confirmation);
  });

  it('retrieves events and passes pagination and recipient filters', async () => {
    const client = makeClient();
    await client.listBirthEvents(farmId, { take: 20, animal_id: farmId });
    expect(http.get).toHaveBeenLastCalledWith(`/farm/${farmId}/birth-events`, {
      params: { take: 20, animal_id: farmId },
    });
    await client.getBirthEvent(farmId, farmId);
    expect(http.get).toHaveBeenLastCalledWith(`/farm/${farmId}/birth-events/${farmId}`);
  });

  it('supports undated tasks and versioned protocols', async () => {
    const client = makeClient();
    await client.listFarmTasks(farmId, { status: 'TODO' });
    expect(http.get).toHaveBeenLastCalledWith(`/farm/${farmId}/farm-tasks`, {
      params: { status: 'TODO' },
    });
    await client.updateFarmTask(farmId, farmId, { status: 'TODO', due_date: null });
    expect(http.put).toHaveBeenLastCalledWith(`/farm/${farmId}/farm-tasks/${farmId}`, {
      status: 'TODO',
      due_date: null,
    });
    await client.listProtocolVersions(farmId, { take: 50 });
    expect(http.get).toHaveBeenLastCalledWith(`/farm/${farmId}/protocol-versions`, {
      params: { take: 50 },
    });
    const definition = { name: 'Neonatal', version: '1', steps: ['Record observations'] };
    await client.createProtocolVersion(farmId, definition);
    expect(http.post).toHaveBeenLastCalledWith(`/farm/${farmId}/protocol-versions`, definition);
  });

  it('reads source evidence within the selected farm without issuing a write', async () => {
    const client = makeClient();
    expect(await client.getBirthSourceEvidence(farmId, farmId)).toEqual({ accepted: true });
    expect(http.get).toHaveBeenCalledWith(`/farm/${farmId}/birth-sources/${farmId}`);
    expect(http.post).not.toHaveBeenCalled();
    expect(http.put).not.toHaveBeenCalled();
  });
  it('routes history settings and evidence without changing their structured payloads', async () => {
    const client = makeClient();
    const settings = { version: 1, species: 'SHEEP', birth_windows: [] };
    await client.getBirthHistorySettings(farmId);
    expect(http.get).toHaveBeenLastCalledWith(`/farm/${farmId}/birth-history/settings`);
    await client.setBirthHistorySettings(farmId, settings);
    expect(http.put).toHaveBeenLastCalledWith(`/farm/${farmId}/birth-history/settings`, settings);
    const params = { dam_id: farmId, birth_date: '2026-09-04' };
    await client.getBirthHistoryEvidence(farmId, params);
    expect(http.get).toHaveBeenLastCalledWith(`/farm/${farmId}/birth-history/evidence`, { params });
  });
});
