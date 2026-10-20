import { registerTools } from '../../../tools';
import { getToolHandler, toolRegistry } from '../../../toolRegistry';
import { handleTool as getAnimalHandler } from '../../../tools/get_animal';
import { handleTool as getBirthHistorySettingsHandler } from '../../../tools/get_birth_history_settings';
import { handleTool as getCurrentContextHandler } from '../../../tools/get_current_context';
import { handleTool as getFarmHandler } from '../../../tools/get_farm';
import { handleTool as listAnimalsHandler } from '../../../tools/list_animals';
import { handleTool as listMyFarmsHandler } from '../../../tools/list_my_farms';
import { handleTool as previewWorkflowHandler } from '../../../tools/preview_workflow';
import { handleTool as setDefaultFarmHandler } from '../../../tools/set_default_farm';
import { handleTool as updateRecordHandler } from '../../../tools/update_record';

/**
 * Explicit handler identities spanning tool families and re-export aliases. The
 * registry must bind these exact functions, not look them up by path.
 */
const expectedHandlers: Record<string, unknown> = {
  get_animal: getAnimalHandler,
  get_birth_history_settings: getBirthHistorySettingsHandler,
  get_current_context: getCurrentContextHandler,
  get_farm: getFarmHandler,
  list_animals: listAnimalsHandler,
  list_my_farms: listMyFarmsHandler,
  preview_workflow: previewWorkflowHandler,
  set_default_farm: setDefaultFarmHandler,
  update_record: updateRecordHandler,
};

describe('toolRegistry', () => {
  it('is frozen against runtime mutation', () => {
    expect(Object.isFrozen(toolRegistry)).toBe(true);
  });

  it('maps each name to its statically imported handler', () => {
    for (const [name, handler] of Object.entries(expectedHandlers)) {
      expect(getToolHandler(name)).toBe(handler);
    }
  });

  it('covers exactly the advertised tool names with no duplicates', () => {
    const advertised = registerTools().map((tool) => tool.name);
    expect(new Set(advertised).size).toBe(advertised.length);
    expect([...advertised].sort()).toEqual(Object.keys(toolRegistry).sort());
  });

  it('exposes a callable handler for every registry entry', () => {
    for (const name of Object.keys(toolRegistry)) {
      expect(typeof getToolHandler(name)).toBe('function');
    }
  });

  it.each([
    'unknown_tool',
    'constructor',
    'toString',
    '__proto__',
    'hasOwnProperty',
    'valueOf',
    './tools/get_animal',
    '../tools/get_animal',
    '../../etc/passwd',
    '/etc/passwd',
    '/tmp/tools/get_animal',
    'node:fs',
    'tools/get_animal',
    'fs',
  ])('getToolHandler returns undefined for unregistered name %s', (name) => {
    expect(getToolHandler(name)).toBeUndefined();
  });
});
