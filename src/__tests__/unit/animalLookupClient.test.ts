import axios from 'axios';
import { RanchBotApiClient } from '../../client';

jest.mock('axios');

describe('read-only animal lookup transport', () => {
  const http = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() };
  beforeEach(() => {
    jest.clearAllMocks();
    (axios.create as jest.Mock).mockReturnValue(http);
  });

  it.each([404, 409])('propagates HTTP %s and makes zero write requests', async (status) => {
    const error = { response: { status } };
    http.get.mockRejectedValue(error);
    const client = new RanchBotApiClient({ accessToken: 'synthetic-token' });
    await expect(client.lookupAnimalByEid('farm', '00&?#/12')).rejects.toBe(error);
    expect(http.get).toHaveBeenCalledWith('/farm/farm/animals/lookup-by-eid', {
      params: { eid: '00&?#/12' },
    });
    expect(http.post).not.toHaveBeenCalled();
    expect(http.put).not.toHaveBeenCalled();
    expect(http.delete).not.toHaveBeenCalled();
  });

  it('returns the found animal from GET', async () => {
    http.get.mockResolvedValue({ data: { id: 'animal' } });
    const client = new RanchBotApiClient({ accessToken: 'synthetic-token' });
    expect(await client.lookupAnimalByEid('farm', '001')).toEqual({ id: 'animal' });
    expect(http.post).not.toHaveBeenCalled();
  });
});
