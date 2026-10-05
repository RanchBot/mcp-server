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
  dirs: ['dist', 'docs', 'skills'],
  rootFiles: ['README.md', 'MAINTAINING.md', 'CONTRIBUTING.md', 'SECURITY.md', 'LICENSE'],
  requiredRootFiles: [
    'README.md',
    'MAINTAINING.md',
    'CONTRIBUTING.md',
    'SECURITY.md',
    'LICENSE',
    'docs/workflows.md',
    'docs/architecture.md',
    'docs/development.md',
    'docs/troubleshooting.md',
    'dist/index.js',
    'dist/index.d.ts',
    'skills/ranchbot/SKILL.md',
  ],
};

/**
 * Public Markdown documents whose links and heading fragments are validated.
 * They must form a self-contained set: every relative target stays inside the
 * package. The private PUBLISHING.md is deliberately not part of this scope.
 */
export const publicDocuments = [
  'README.md',
  'MAINTAINING.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'docs/workflows.md',
  'docs/architecture.md',
  'docs/development.md',
  'docs/troubleshooting.md',
  'skills/ranchbot/SKILL.md',
  'skills/ranchbot/references/cli.md',
  'skills/ranchbot/references/mcp.md',
  'skills/ranchbot/references/birth-events.md',
  'skills/ranchbot/references/exports.md',
];

/**
 * Documents the README links to that must survive both the standalone source
 * export and package assembly. A missing file fails the release tests instead
 * of silently dropping a README target.
 */
export const requiredDocuments = [
  'CONTRIBUTING.md',
  'SECURITY.md',
  'docs/workflows.md',
  'docs/architecture.md',
  'docs/development.md',
  'docs/troubleshooting.md',
];

/**
 * The explicit `git archive` source-export allowlist documented in
 * PUBLISHING.md. Kept here so the release tests can prove every required
 * document is exported while PUBLISHING.md stays the human-readable procedure.
 */
export const sourceExport = [
  'mcp-server/src',
  'mcp-server/scripts',
  'mcp-server/.github',
  'mcp-server/skills',
  'mcp-server/package.json',
  'mcp-server/package-lock.json',
  'mcp-server/README.md',
  'mcp-server/MAINTAINING.md',
  'mcp-server/LICENSE',
  'mcp-server/server.json',
  'mcp-server/docs',
  'mcp-server/CONTRIBUTING.md',
  'mcp-server/SECURITY.md',
  'mcp-server/tsconfig.json',
  'mcp-server/tsconfig.build.json',
  'mcp-server/jest.config.cjs',
  'mcp-server/.eslintrc.json',
  'mcp-server/.prettierrc',
  'mcp-server/.prettierignore',
  'mcp-server/.gitignore',
];

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
    ...pinnedReferenceChecks({
      text: readme,
      packageName,
      label: 'README.md',
      requirePins: true,
      requiredSnippets: [`npm install -g ${packageName}@`],
    }),
  ];
}

export const installCommands = [
  'npm install -g @ranchbot/mcp-server@${version}',
  'npx -y @ranchbot/mcp-server@${version} --version',
  'npx -y @ranchbot/mcp-server@${version} --help',
];

/**
 * MCP Registry (DNS-authenticated) publication settings. The Registry trusts
 * control of `ranch.bot`, proven through a TXT record, rather than an npm token.
 */
export const mcpRegistry = {
  serverName: 'bot.ranch/mcp-server',
  domain: 'ranch.bot',
  registryUrl: 'https://registry.modelcontextprotocol.io',
  enabledVariable: 'MCP_REGISTRY_RELEASE_ENABLED',
  privateKeySecret: 'MCP_DNS_PRIVATE_KEY',
  transport: 'stdio',
  publisherVersion: 'v1.8.1',
  publisherAsset: 'mcp-publisher_linux_amd64.tar.gz',
  publisherSha256: 'a06c9096dcb9727c13555b6be26c7effa707b01f06a4c561ba7a3635443cf2cc',
};

export const warnings = [
  'Ranch.Bot operates no hosted MCP endpoint; the local stdio package is the only connection surface.',
  'Upgrade only after stopping any older `ranchbot-mcp` process; a running older version can hold the local credential lock.',
  'Re-run `ranchbot-mcp login` if your local session predates this release.',
];
