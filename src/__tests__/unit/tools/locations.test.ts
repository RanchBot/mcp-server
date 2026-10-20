import { registerTools } from '../../../tools';
import { getToolHandler } from '../../../toolRegistry';
import { handleTool as addPremisesIdentifier } from '../../../tools/add_premises_identifier';
import { handleTool as archiveLocation } from '../../../tools/archive_location';
import { handleTool as createLocation } from '../../../tools/create_location';
import { handleTool as deletePremisesIdentifier } from '../../../tools/delete_premises_identifier';
import { handleTool as getLocation } from '../../../tools/get_location';
import { handleTool as listLocations } from '../../../tools/list_locations';
import { handleTool as restoreLocation } from '../../../tools/restore_location';
import { handleTool as setHomeLocation } from '../../../tools/set_home_location';
import { handleTool as updateLocation } from '../../../tools/update_location';
import { handleTool as updatePremisesIdentifier } from '../../../tools/update_premises_identifier';
import { createMockClient } from '../testUtils';

it('lists locations with the archived flag and resolves the farm', async () => {
  const client = createMockClient();
  client.listLocations.mockResolvedValue({ total: 1, locations: [{ id: 'loc-1' }] } as any);
  const result = await listLocations(client, 'default-farm', { include_archived: true });
  expect(client.listLocations).toHaveBeenCalledWith('default-farm', { include_archived: true });
  expect(result.message).toBe('Found 1 location(s)');
  await expect(listLocations(client, '', {})).rejects.toThrow('farm_id is required');
});

it('creates a location without leaking farm_id into the body', async () => {
  const client = createMockClient();
  client.createLocation.mockResolvedValue({ location: { id: 'loc-1' } } as any);
  await createLocation(client, 'default', { farm_id: 'selected', name: 'Home', parent_id: null });
  expect(client.createLocation).toHaveBeenCalledWith('selected', { name: 'Home', parent_id: null });
});

it('archives and restores with an optional expected version', async () => {
  const client = createMockClient();
  client.archiveLocation.mockResolvedValue({});
  client.restoreLocation.mockResolvedValue({});
  await archiveLocation(client, 'farm', { location_id: 'loc-1', expected_version: 3 });
  await archiveLocation(client, 'farm', { location_id: 'loc-1' });
  expect(client.archiveLocation).toHaveBeenCalledWith('farm', 'loc-1', 3);
  expect(client.archiveLocation).toHaveBeenCalledWith('farm', 'loc-1', undefined);
  await restoreLocation(client, 'farm', { location_id: 'loc-1' });
  expect(client.restoreLocation).toHaveBeenCalledWith('farm', 'loc-1', undefined);
});

it('sets or clears the explicit home premises', async () => {
  const client = createMockClient();
  client.setHomeLocation.mockResolvedValue({ home_location_id: 'loc-1' });
  expect(await setHomeLocation(client, 'farm', { location_id: 'loc-1' })).toMatchObject({
    home_location_id: 'loc-1',
  });
  const cleared = await setHomeLocation(client, 'farm', { location_id: null });
  expect(client.clearHomeLocation).toHaveBeenCalledWith('farm');
  expect(cleared).toMatchObject({ home_location_id: null });
});

it('adds and removes premises identifiers', async () => {
  const client = createMockClient();
  client.addPremisesIdentifier.mockResolvedValue({ identifier: { id: 'pid-1' } } as any);
  await addPremisesIdentifier(client, 'farm', {
    location_id: 'loc-1',
    scheme: 'CA_PID',
    value: 'A0012345',
    confirmed: true,
  });
  expect(client.addPremisesIdentifier).toHaveBeenCalledWith('farm', 'loc-1', {
    scheme: 'CA_PID',
    value: 'A0012345',
    confirmed: true,
  });
  await deletePremisesIdentifier(client, 'farm', { location_id: 'loc-1', identifier_id: 'pid-1' });
  expect(client.deletePremisesIdentifier).toHaveBeenCalledWith('farm', 'loc-1', 'pid-1');
});

it('publishes schemas, annotations, and handler mappings for the location tools', () => {
  const tools = new Map(registerTools().map((tool) => [tool.name, tool]));
  const reads = ['list_locations', 'get_location'];
  const readHandlers: Record<string, unknown> = {
    list_locations: listLocations,
    get_location: getLocation,
  };
  for (const name of reads) {
    expect(tools.get(name)?.annotations?.readOnlyHint).toBe(true);
    expect(getToolHandler(name)).toBe(readHandlers[name]);
  }
  expect(tools.get('create_location')?.inputSchema.required).toEqual(['name']);
  expect(tools.get('archive_location')?.annotations?.destructiveHint).toBe(true);
  expect(getToolHandler('set_home_location')).toBe(setHomeLocation);
  expect(getToolHandler('update_premises_identifier')).toBe(updatePremisesIdentifier);
  expect(tools.get('update_premises_identifier')?.annotations).toMatchObject({
    readOnlyHint: false,
    destructiveHint: false,
  });
});

it('publishes enum-validated update schemas including null', () => {
  const tools = new Map(registerTools().map((tool) => [tool.name, tool]));
  const updateIdentifier = tools.get('update_premises_identifier')!;
  expect(updateIdentifier.inputSchema.required).toEqual(['location_id', 'identifier_id']);
  const identifierProperties = updateIdentifier.inputSchema.properties as Record<string, any>;
  expect(identifierProperties.scheme.enum).toEqual(['CA_PID', 'US_PIN', 'US_LID', 'OTHER']);
  expect(identifierProperties.scheme_label.type).toEqual(['string', 'null']);
  expect(identifierProperties.expected_version.type).toBe('integer');

  const updateLocation = tools.get('update_location')!;
  const locationProperties = updateLocation.inputSchema.properties as Record<string, any>;
  expect(locationProperties.category.enum).toEqual([
    'FARM',
    'FIELD',
    'PEN',
    'BARN',
    'VET',
    'RODEO',
    'ABATTOIR',
    'AUCTION',
    'OTHER',
    null,
  ]);
  expect(locationProperties.context.enum).toEqual(['OPERATED', 'LEASED', 'EXTERNAL', null]);
});

it('rejects invalid location enums before calling the client', async () => {
  const client = createMockClient();
  client.updateLocation.mockResolvedValue({ location: { id: 'loc-1' } } as any);
  await updateLocation(client, 'farm', {
    location_id: 'loc-1',
    category: null,
    context: 'EXTERNAL',
  });
  expect(client.updateLocation).toHaveBeenCalledWith('farm', 'loc-1', {
    category: null,
    context: 'EXTERNAL',
  });
  await expect(
    updateLocation(client, 'farm', { location_id: 'loc-1', category: 'BOGUS' }),
  ).rejects.toThrow();
  await expect(
    updateLocation(client, 'farm', { location_id: 'loc-1', context: 'BOGUS' }),
  ).rejects.toThrow();
  expect(client.updateLocation).toHaveBeenCalledTimes(1);
});

it('updates a premises identifier with partial fields and resolves the farm', async () => {
  const client = createMockClient();
  const locationId = '11111111-1111-4111-8111-111111111111';
  const identifierId = '22222222-2222-4222-8222-222222222222';
  client.updatePremisesIdentifier.mockResolvedValue({ identifier: { id: identifierId } } as any);
  const result = await updatePremisesIdentifier(client, 'default-farm', {
    location_id: locationId,
    identifier_id: identifierId,
    value: '000123',
    scheme_label: null,
    confirmed: false,
    expected_version: 3,
  });
  // Routing identifiers are excluded from the body; false and null are preserved.
  expect(client.updatePremisesIdentifier).toHaveBeenCalledWith(
    'default-farm',
    locationId,
    identifierId,
    { value: '000123', scheme_label: null, confirmed: false, expected_version: 3 },
  );
  expect(result.message).toBe(`Premises identifier ${identifierId} updated`);
});

it('honors an explicit farm and rejects malformed identifier updates without a client call', async () => {
  const client = createMockClient();
  const locationId = '11111111-1111-4111-8111-111111111111';
  const identifierId = '22222222-2222-4222-8222-222222222222';
  client.updatePremisesIdentifier.mockResolvedValue({} as any);
  await updatePremisesIdentifier(client, '', {
    farm_id: 'selected',
    location_id: locationId,
    identifier_id: identifierId,
    is_preferred: false,
  });
  expect(client.updatePremisesIdentifier).toHaveBeenCalledWith(
    'selected',
    locationId,
    identifierId,
    {
      is_preferred: false,
    },
  );
  await expect(
    updatePremisesIdentifier(client, 'farm', { location_id: 'nope', identifier_id: identifierId }),
  ).rejects.toThrow();
  await expect(
    updatePremisesIdentifier(client, 'farm', {
      location_id: locationId,
      identifier_id: identifierId,
      scheme: 'BOGUS',
    }),
  ).rejects.toThrow();
  await expect(
    updatePremisesIdentifier(client, 'farm', {
      location_id: locationId,
      identifier_id: identifierId,
      value: '',
    }),
  ).rejects.toThrow();
  await expect(
    updatePremisesIdentifier(client, 'farm', {
      location_id: locationId,
      identifier_id: identifierId,
      expected_version: -1,
    }),
  ).rejects.toThrow();
  expect(client.updatePremisesIdentifier).toHaveBeenCalledTimes(1);
});
