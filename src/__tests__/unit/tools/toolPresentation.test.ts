import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { generatedCrudTools } from '../../../generated/toolContracts';
import { registerTools } from '../../../tools';
import {
  humanizeToolName,
  readableToolTitle,
  withReadableTitle,
} from '../../../tools/toolPresentation';

describe('local MCP tool presentation', () => {
  it('humanizes snake_case identifiers and uppercases EID', () => {
    expect(humanizeToolName('get_animal')).toBe('Get animal');
    expect(humanizeToolName('lookup_animal_by_eid')).toBe('Lookup animal by EID');
    expect(humanizeToolName('find_or_create_animal_by_eid')).toBe('Find or create animal by EID');
  });

  it('resolves the display name from curated title, then a differing annotation title', () => {
    const base: Tool = { name: 'get_animal', inputSchema: { type: 'object' } };
    expect(readableToolTitle({ ...base, title: 'Read an animal' })).toBe('Read an animal');
    expect(readableToolTitle({ ...base, annotations: { title: 'Read animal' } })).toBe(
      'Read animal',
    );
    // The generated raw-name annotation is superseded by the humanized name.
    expect(readableToolTitle({ ...base, annotations: { title: 'get_animal' } })).toBe('Get animal');
    expect(readableToolTitle({ ...base, title: '   ', annotations: { title: '   ' } })).toBe(
      'Get animal',
    );
  });

  it('copies the tool with identical titles, preserves hints and schema, and never mutates it', () => {
    const source: Tool = {
      name: 'create_animal',
      inputSchema: { type: 'object', properties: { name: { type: 'string' } } },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    };
    const presented = withReadableTitle(source);
    expect(presented).not.toBe(source);
    expect(presented.title).toBe('Create animal');
    expect(presented.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      title: 'Create animal',
    });
    expect(presented.inputSchema).toEqual(source.inputSchema);
    // The source definition keeps its raw annotations and gains no top-level title.
    expect(source.title).toBeUndefined();
    expect(source.annotations?.title).toBeUndefined();
  });

  it('falls back for generated raw-name titles without mutating the generated definitions', () => {
    const presented = new Map(registerTools().map((tool) => [tool.name, tool]));
    for (const tool of generatedCrudTools) {
      const registered = presented.get(tool.name)!;
      expect(registered.title).toBe(humanizeToolName(tool.name));
      expect(registered.annotations?.title).toBe(registered.title);
      // The generated source is untouched: raw annotation name, no top-level title.
      expect(tool.title).toBeUndefined();
      expect(tool.annotations?.title).toBe(tool.name);
    }
  });

  it('gives every advertised tool a nonblank matching title', () => {
    for (const tool of registerTools()) {
      expect(typeof tool.title).toBe('string');
      expect((tool.title ?? '').trim().length).toBeGreaterThan(0);
      expect(tool.annotations?.title).toBe(tool.title);
    }
  });
});
