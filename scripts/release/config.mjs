/**
 * Package-specific release configuration for @ranchbot/mcp-server.
 * Kept separate so `main.mjs` and the tests share one source of truth.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const packageName = '@ranchbot/mcp-server';
export const repository = 'RanchBot/mcp-server';
export const binary = 'ranchbot-mcp';

/** Runtime allowlist for the published tarball. `server.json` stays in the repo. */
export const tarball = {
  dirs: ['dist'],
  rootFiles: ['README.md', 'LICENSE'],
  requiredRootFiles: ['README.md', 'LICENSE', 'dist/index.js', 'dist/index.d.ts'],
};

/** Every declared version that must match the release tag. */
export function extraVersionChecks(root) {
  const serverJson = JSON.parse(readFileSync(join(root, 'server.json'), 'utf8'));
  const index = readFileSync(join(root, 'src/index.ts'), 'utf8');
  const factory = readFileSync(join(root, 'src/serverFactory.ts'), 'utf8');
  return [
    { label: 'server.json version', value: serverJson.version },
    { label: 'server.json packages[0].version', value: serverJson.packages?.[0]?.version },
    {
      label: 'src/index.ts --version output',
      value: /console\.log\('(\d+\.\d+\.\d+)'\)/.exec(index)?.[1],
    },
    {
      label: 'src/serverFactory.ts handshake version',
      value: /version: '(\d+\.\d+\.\d+)'/.exec(factory)?.[1],
    },
  ];
}

export const installCommands = [
  'npm install -g @ranchbot/mcp-server@${version}',
  'npx -y @ranchbot/mcp-server@${version} --version',
  'npx -y @ranchbot/mcp-server@${version} --help',
];

export const warnings = [
  'MCP Registry publication for `bot.ranch/mcp-server` is a separate founder-run step; this GitHub release does not publish to the Registry.',
  'Upgrade only after stopping any older `ranchbot-mcp` process; a running older version can hold the local credential lock.',
  'Re-run `ranchbot-mcp login` if your local session predates this release.',
];
