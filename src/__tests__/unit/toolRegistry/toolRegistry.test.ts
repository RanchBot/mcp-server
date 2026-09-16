import { getToolHandlerPath, toolRegistry } from '../../../toolRegistry';

describe('toolRegistry', () => {
  it('contains all expected tool mappings', () => {
    expect(toolRegistry).toMatchObject({
      // Farm tools
      list_my_farms: './tools/list_my_farms.js',
      get_farm: './tools/get_farm.js',
      set_default_farm: './tools/set_default_farm.js',
      get_current_context: './tools/get_current_context.js',

      // Animal tools
      list_animals: './tools/list_animals.js',
      get_animal: './tools/get_animal.js',
      create_animal: './tools/create_animal.js',
      update_animal: './tools/update_animal.js',
      delete_animal: './tools/delete_animal.js',
      find_animal_by_identifier: './tools/find_animal_by_identifier.js',

      // Identifier tools
      list_identifiers: './tools/list_identifiers.js',
      add_identifier: './tools/add_identifier.js',
      remove_identifier: './tools/remove_identifier.js',

      // Group tools
      list_groups: './tools/list_groups.js',
      get_group: './tools/get_group.js',
      create_group: './tools/create_group.js',
      update_group: './tools/update_group.js',
      delete_group: './tools/delete_group.js',

      // Record tools
      list_records: './tools/list_records.js',
      get_record: './tools/get_record.js',
      create_record: './tools/create_record.js',
      update_record: './tools/update_record.js',
      delete_record: './tools/delete_record.js',
    });
  });

  it('getToolHandlerPath returns mapped handler path', () => {
    expect(getToolHandlerPath('list_my_farms')).toBe('./tools/list_my_farms.js');
  });

  it('getToolHandlerPath returns undefined for unknown tools', () => {
    expect(getToolHandlerPath('unknown_tool')).toBeUndefined();
  });
});
