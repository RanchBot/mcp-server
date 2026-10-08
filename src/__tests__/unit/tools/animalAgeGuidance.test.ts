import { generatedCrudTools } from '../../../generated/toolContracts';
import { registerTools } from '../../../tools';
import { SERVER_INSTRUCTIONS } from '../../../serverInstructions';

/**
 * #1309 acceptance: the published MCP schema must not tell a client to derive an exact birthday
 * from an approximate age, and the always-present initialize instructions must keep age approximate.
 */
it('published create/update schemas state exact-date guidance and never derive a birthday from age', () => {
  for (const name of ['create_animal', 'update_animal']) {
    const tool = generatedCrudTools.find((entry) => entry.name === name);
    expect(tool).toBeDefined();
    const description = (tool!.inputSchema.properties as Record<string, { description: string }>)
      .birth_date.description;
    expect(description).toMatch(/Exact date of birth/);
    expect(description).toMatch(/only when the user states the date/);
    expect(description).toMatch(/never calculate or estimate a birthday from an age/);
    expect(description).not.toMatch(/derive it from an age/i);
  }
});

it('no published tool schema tells the agent to derive a birthday from an age', () => {
  expect(JSON.stringify(generatedCrudTools)).not.toMatch(/derive it from an age/i);
  expect(JSON.stringify(registerTools())).not.toMatch(/derive it from an age/i);
});

it('server initialize instructions keep an approximate age out of birth_date', () => {
  expect(SERVER_INSTRUCTIONS).toMatch(/approximate age is not a date/i);
  expect(SERVER_INSTRUCTIONS).toMatch(
    /never calculate, estimate, or overwrite an existing birthday/i,
  );
});
