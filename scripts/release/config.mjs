/**
 * Package-specific release configuration for @ranchbot/mcp-server.
 * Kept separate so `main.mjs` and the tests share one source of truth.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pinnedReferenceChecks, serverJsonVersionChecks } from './release.mjs';

export const packageName = '@ranchbot/mcp-server';
export const repository = 'RanchBot/mcp-server';
export const binary = 'ranchbot-mcp';

/** Runtime allowlist for the published tarball. `server.json` stays in the repo. */
export const tarball = {
  dirs: ['dist', 'skills'],
  rootFiles: ['README.md', 'LICENSE'],
  requiredRootFiles: [
    'README.md',
    'LICENSE',
    'dist/index.js',
    'dist/index.d.ts',
    'skills/ranchbot/SKILL.md',
  ],
};

/**
 * Every declared version that must match the release tag or candidate. Runtime
 * CLI/MCP versions derive from package metadata, so server.json and any
 * packaged README pins still need an explicit copy check.
 */
export function extraVersionChecks(root) {
  const serverJson = JSON.parse(readFileSync(join(root, 'server.json'), 'utf8'));
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  return [
    ...serverJsonVersionChecks(serverJson, packageName),
    ...pinnedReferenceChecks({ text: readme, packageName, label: 'README.md' }),
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
