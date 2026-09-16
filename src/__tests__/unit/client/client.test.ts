import axios, { AxiosInstance } from 'axios';

import { RanchBotApiClient } from '../../../client';

jest.mock('axios');
jest.mock('../../../config', () => ({
  API_VERSION: 'v1',
  RANCHBOT_API_URL: 'http://localhost:7001',
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('RanchBotApiClient', () => {
  let axiosInstance: jest.Mocked<AxiosInstance>;

  beforeEach(() => {
    axiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<AxiosInstance>;

    mockedAxios.create.mockReturnValue(axiosInstance);
  });

  it('creates axios client with correct base URL and headers', () => {
    const client = new RanchBotApiClient({ accessToken: 'test-token' });

    expect(client).toBeInstanceOf(RanchBotApiClient);
    expect(mockedAxios.create).toHaveBeenCalledWith({
      baseURL: expect.stringContaining('/api/'),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
    });
  });

  it('lists farms and normalizes response shape', async () => {
    axiosInstance.get.mockResolvedValueOnce({
      data: {
        records: [{ id: 'farm-1' }],
        total: 1,
      },
    } as any);

    const client = new RanchBotApiClient({ accessToken: 'test-token' });
    const result = await client.getFarms();

    expect(axiosInstance.get).toHaveBeenCalledWith('/farm');
    expect(result).toEqual({
      farms: [{ id: 'farm-1' }],
      total: 1,
    });
  });

  it('delegates simple getters and mutators to axios instance', async () => {
    axiosInstance.get.mockResolvedValue({ data: { id: 'farm-1' } } as any);

    const client = new RanchBotApiClient({ accessToken: 'test-token' });

    await client.getFarm('farm-1');
    expect(axiosInstance.get).toHaveBeenCalledWith('/farm/farm-1');

    await client.listAnimals('farm-1', { skip: 1, take: 10 });
    expect(axiosInstance.get).toHaveBeenCalledWith('/farm/farm-1/animals', {
      params: { skip: 1, take: 10 },
    });

    await client.getAnimal('farm-1', 'animal-1');
    expect(axiosInstance.get).toHaveBeenCalledWith('/farm/farm-1/animals/animal-1');

    await client.listGroups('farm-1');
    expect(axiosInstance.get).toHaveBeenCalledWith('/farm/farm-1/groups');

    await client.getGroup('farm-1', 'group-1');
    expect(axiosInstance.get).toHaveBeenCalledWith('/farm/farm-1/groups/group-1');

    await client.listRecords('farm-1', { type: 'HEALTH' });
    expect(axiosInstance.get).toHaveBeenCalledWith('/farm/farm-1/records', {
      params: { type: 'HEALTH' },
    });

    await client.getRecord('farm-1', 'record-1');
    expect(axiosInstance.get).toHaveBeenCalledWith('/farm/farm-1/records/record-1');
  });

  it('delegates create, update, and delete operations to axios instance', async () => {
    axiosInstance.post.mockResolvedValue({ data: { id: 'created' } } as any);
    axiosInstance.put.mockResolvedValue({ data: { id: 'updated' } } as any);
    axiosInstance.delete.mockResolvedValue({} as any);
    // Methods that read response.data from GET requests should also receive a value
    axiosInstance.get.mockResolvedValue({ data: {} } as any);

    const client = new RanchBotApiClient({ accessToken: 'test-token' });

    await client.createAnimal('farm-1', { metadata: { a: 1 } });
    expect(axiosInstance.post).toHaveBeenCalledWith('/farm/farm-1/animals', {
      metadata: { a: 1 },
    });

    await client.updateAnimal('farm-1', 'animal-1', { metadata: { b: 2 } });
    expect(axiosInstance.put).toHaveBeenCalledWith('/farm/farm-1/animals/animal-1', {
      metadata: { b: 2 },
    });

    await client.deleteAnimal('farm-1', 'animal-1');
    expect(axiosInstance.delete).toHaveBeenCalledWith('/farm/farm-1/animals/animal-1');

    await client.findOrCreateAnimalByEid('farm-1', 'EID123');
    expect(axiosInstance.post).toHaveBeenCalledWith('/farm/farm-1/animals/find-or-create-by-eid', {
      eid: 'EID123',
    });

    await client.listAnimalIdentifiers('farm-1', 'animal-1');
    expect(axiosInstance.get).toHaveBeenCalledWith('/farm/farm-1/animals/animal-1/identifier');

    await client.addAnimalIdentifier('farm-1', 'animal-1', {
      type: 'EID',
      value: '123',
      is_primary: true,
    });
    expect(axiosInstance.post).toHaveBeenCalledWith('/farm/farm-1/animals/animal-1/identifier', {
      type: 'EID',
      value: '123',
      is_primary: true,
    });

    await client.removeAnimalIdentifier('farm-1', 'animal-1', 'ident-1');
    expect(axiosInstance.delete).toHaveBeenCalledWith(
      '/farm/farm-1/animals/animal-1/identifier/ident-1',
    );

    await client.createGroup('farm-1', { name: 'Group', description: 'desc' });
    expect(axiosInstance.post).toHaveBeenCalledWith('/farm/farm-1/groups', {
      name: 'Group',
      description: 'desc',
    });

    await client.updateGroup('farm-1', 'group-1', { name: 'New' });
    expect(axiosInstance.put).toHaveBeenCalledWith('/farm/farm-1/groups/group-1', { name: 'New' });

    await client.deleteGroup('farm-1', 'group-1');
    expect(axiosInstance.delete).toHaveBeenCalledWith('/farm/farm-1/groups/group-1');

    await client.restoreGroup('farm-1', 'group-1');
    expect(axiosInstance.post).toHaveBeenCalledWith('/farm/farm-1/groups/group-1/restore');

    await client.createRecord('farm-1', {
      applied_at: '2024-01-01T00:00:00Z',
      name: 'Record',
      type: 'HEALTH',
      animal_ids: ['a1'],
      group_ids: ['g1'],
      description: 'desc',
    });
    expect(axiosInstance.post).toHaveBeenCalledWith('/farm/farm-1/records', {
      applied_at: '2024-01-01T00:00:00Z',
      name: 'Record',
      type: 'HEALTH',
      animal_ids: ['a1'],
      group_ids: ['g1'],
      description: 'desc',
    });

    await client.updateRecord('farm-1', 'record-1', {
      applied_at: '2024-01-02T00:00:00Z',
      name: 'Updated',
      type: 'FEED',
      description: 'changed',
    });
    expect(axiosInstance.put).toHaveBeenCalledWith('/farm/farm-1/records/record-1', {
      applied_at: '2024-01-02T00:00:00Z',
      name: 'Updated',
      type: 'FEED',
      description: 'changed',
    });

    await client.deleteRecord('farm-1', 'record-1');
    expect(axiosInstance.delete).toHaveBeenCalledWith('/farm/farm-1/records/record-1');
  });
});
