#!/usr/bin/env node
/**
 * Release workflow entrypoint for the standalone package repository.
 * Performs all file, npm, and git/GitHub I/O; the decisions live in
 * `release.mjs` so they can be unit tested without side effects.
 *
 * Subcommands: validate-tag | check-tarball | registry-status | verify-registry
 * | render-notes | github-release
 *
 * The module is import-safe: `runGitHubRelease` is exported with injectable
 * `io`/`fs` so tests can exercise the recovery ordering without `gh`, npm, or
 * credentials. The CLI dispatch only runs when this file is the entrypoint.
 */
import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  MANIFEST_ASSET_NAME,
  assertReleaseIdentity,
  assertTarballAllowlist,
  assertVersionAlignment,
  buildReleaseManifest,
  compareManifests,
  gitHubReleasePlan,
  parseManifest,
  parsePackResult,
  parseStableTag,
  readRegistryView,
  registryDecision,
  releaseEnabled,
  renderReleaseNotes,
  sha512Integrity,
  verifyRegistry,
  versionChecks,
} from './release.mjs';
import * as config from './config.mjs';

const root = process.env.RELEASE_ROOT || process.cwd();
const NPM_TIMEOUT_MS = 30000;
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));

function setOutput(pairs) {
  const text = `${Object.entries(pairs)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, text);
  else process.stdout.write(text);
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', ...options });
}

function flag(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

function collectFlag(name) {
  const values = [];
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] === name) values.push(process.argv[i + 1]);
  }
  return values;
}

function gate() {
  const enabled = releaseEnabled(process.env.NPM_RELEASE_ENABLED);
  setOutput({ enabled: String(enabled) });
  if (!enabled) {
    console.log(
      "::notice::NPM_RELEASE_ENABLED is not 'true'; publication is disabled for this tag.",
    );
  }
}

function validateTag() {
  const { version, tag } = parseStableTag(process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME);
  const identity = process.env.RELEASE_REPOSITORY || process.env.GITHUB_REPOSITORY;
  if (identity !== config.repository) {
    throw new Error(`Repository is ${identity}, expected ${config.repository}`);
  }
  const sha = process.env.RELEASE_SHA || process.env.GITHUB_SHA;
  if (!/^[a-f0-9]{40}$/.test(String(sha ?? ''))) {
    throw new Error(`Release source must be a full 40-character commit, received ${sha}`);
  }
  const packageJson = readJson('package.json');
  const lockfile = readJson('package-lock.json');
  assertVersionAlignment(
    version,
    versionChecks({ packageJson, lockfile, extra: config.extraVersionChecks(root) }),
  );
  setOutput({ version, tag, sha });
}

function checkTarball() {
  const packPath = process.env.PACK_RESULT || 'pack-result.json';
  const record = parsePackResult(readJson(packPath), config.packageName);
  assertTarballAllowlist(
    record.files.map((file) => file.path),
    config.tarball,
  );
  const buffer = readFileSync(join(root, record.filename));
  const integrity = sha512Integrity(buffer);
  if (integrity !== record.integrity) {
    throw new Error(
      `Tarball integrity ${integrity} does not match npm pack's ${record.integrity}; rebuild before publishing`,
    );
  }
  const manifest = buildReleaseManifest({
    repository: config.repository,
    packageName: config.packageName,
    version: process.env.RELEASE_VERSION,
    tag: process.env.RELEASE_TAG,
    sourceSha: process.env.RELEASE_SHA,
    integrity,
    filename: record.filename,
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    workflow: process.env.GITHUB_WORKFLOW,
    workflowRef: process.env.GITHUB_WORKFLOW_REF,
  });
  writeFileSync(join(root, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  setOutput({ filename: record.filename, integrity });
}

/** Registry runner bounded so a hung `npm view` cannot stall the release. */
const npmRunner = (command, args) => run(command, args, { timeout: NPM_TIMEOUT_MS });

function registryStatus() {
  const version = process.env.RELEASE_VERSION;
  const integrity = process.env.RELEASE_INTEGRITY;
  const registry = process.env.NPM_REGISTRY || 'https://registry.npmjs.org';
  const view = readRegistryView({
    runner: npmRunner,
    packageName: config.packageName,
    version,
    registry,
  });
  const decision = registryDecision({ version, integrity, view });
  setOutput({ publish: String(decision.publish), exists: String(view.exists) });
  console.log(`registry: ${decision.reason}`);
}

async function verifyRegistryEntry() {
  const version = process.env.RELEASE_VERSION;
  const integrity = process.env.RELEASE_INTEGRITY;
  const registry = process.env.NPM_REGISTRY || 'https://registry.npmjs.org';
  const result = await verifyRegistry({
    version,
    integrity,
    read: () =>
      readRegistryView({ runner: npmRunner, packageName: config.packageName, version, registry }),
  });
  setOutput({ verified: 'true', exists: 'true' });
  console.log(`registry: verified ${version} after ${result.attempts} check(s)`);
}

function renderNotes() {
  const version = process.env.RELEASE_VERSION;
  const generatedNotesPath = flag('--generated-notes');
  const generatedNotes = generatedNotesPath ? readFileSync(generatedNotesPath, 'utf8') : '';
  const notes = renderReleaseNotes({
    packageName: config.packageName,
    version,
    generatedNotes,
    installCommands: config.installCommands.map((command) =>
      command.replace('${version}', version),
    ),
    warnings: config.warnings,
    sourceSha: process.env.RELEASE_SHA,
    integrity: process.env.RELEASE_INTEGRITY,
  });
  writeFileSync(join(root, 'release-notes.md'), notes);
  setOutput({ notes: 'release-notes.md' });
}

function viewRelease(tag) {
  try {
    const stdout = run('gh', [
      'release',
      'view',
      tag,
      '--json',
      'tagName,targetCommitish,isPrerelease,isDraft,assets',
    ]);
    return JSON.parse(stdout);
  } catch (error) {
    const text = `${error.stdout ?? ''}\n${error.stderr ?? ''}`;
    if (/not found|HTTP 404/i.test(text)) return null;
    throw error;
  }
}

/** Real `gh`/filesystem adapter used by the CLI; tests inject their own. */
function createGitHubIo() {
  return {
    assertIdentity() {
      return run('gh', ['api', 'user', '--jq', '.login']).trim();
    },
    readRelease(tag) {
      return viewRelease(tag);
    },
    createDraft({ tag, sha, title, notesFile, assetPaths }) {
      run('gh', [
        'release',
        'create',
        tag,
        '--draft',
        '--target',
        sha,
        '--title',
        title,
        '--notes-file',
        notesFile,
        '--verify-tag',
        ...assetPaths,
      ]);
    },
    uploadAsset(tag, path) {
      run('gh', ['release', 'upload', tag, path]);
    },
    downloadAsset({ tag, name, destDir }) {
      run('gh', ['release', 'download', tag, '--pattern', name, '--dir', destDir]);
      return join(destDir, name);
    },
    publishDraft(tag) {
      run('gh', ['release', 'edit', tag, '--draft=false']);
    },
  };
}

const workFs = {
  mkdtemp: (prefix) => mkdtempSync(join(tmpdir(), prefix)),
  mkdir: (dir) => {
    mkdirSync(dir, { recursive: true });
    return dir;
  },
  removeDir: (dir) => rmSync(dir, { recursive: true, force: true }),
  readFile: (path) => readFileSync(path),
};

function assertExpectedManifest(manifest, expected) {
  const fields = {
    repository: expected.repository,
    packageName: expected.packageName,
    version: expected.version,
    tag: expected.tag,
    sourceSha: expected.sha,
    integrity: expected.integrity,
    filename: expected.filename,
  };
  for (const [field, value] of Object.entries(fields)) {
    if (manifest[field] !== value) {
      throw new Error(
        `Local release manifest ${field} is ${JSON.stringify(manifest[field])}, ` +
          `expected ${JSON.stringify(value)}`,
      );
    }
  }
}

/**
 * Download every required asset into `dir` and verify its content. The tarball
 * must hash to the candidate integrity. A manifest uploaded in this run must
 * match the local bytes exactly; a preserved existing manifest must keep the
 * exact bytes observed before the upload.
 */
function verifyRemoteAssets({
  io,
  fs,
  tag,
  dir,
  names,
  expected,
  localManifestBytes,
  acceptedManifestBytes,
  uploaded,
}) {
  for (const name of names) {
    const path = io.downloadAsset({ tag, name, destDir: dir });
    const bytes = fs.readFile(path);
    if (name === expected.filename) {
      const integrity = sha512Integrity(bytes);
      if (integrity !== expected.integrity) {
        throw new Error(
          `Release asset ${name} has integrity ${integrity}, expected ${expected.integrity}`,
        );
      }
      continue;
    }
    if (name !== MANIFEST_ASSET_NAME) continue;
    if (uploaded.has(name)) {
      if (!bytes.equals(localManifestBytes)) {
        throw new Error('Uploaded release manifest does not match the local candidate bytes');
      }
      continue;
    }
    if (!acceptedManifestBytes) {
      throw new Error('Existing release manifest was not verified before upload');
    }
    if (sha512Integrity(bytes) !== sha512Integrity(acceptedManifestBytes)) {
      throw new Error('Existing release manifest changed during the release');
    }
  }
}

/**
 * Full GitHub-release recovery sequence. Any failure rejects, so the caller
 * exits nonzero. A retry always re-reads remote state instead of assuming an
 * interrupted command did not apply.
 */
export async function runGitHubRelease({ io, fs, tag, sha, title, notesFile, assets, expected }) {
  const login = io.assertIdentity();
  if (login !== 'ranchbot-dev') {
    throw new Error(`GitHub release must be created as ranchbot-dev, authenticated as ${login}`);
  }

  const byName = new Map();
  for (const asset of assets) {
    if (byName.has(asset.name)) {
      throw new Error(`Expected release asset names must be unique: ${asset.name}`);
    }
    byName.set(asset.name, asset);
  }
  const tarball = byName.get(expected.filename);
  const manifestAsset = byName.get(MANIFEST_ASSET_NAME);
  if (!tarball) throw new Error(`Local release assets are missing ${expected.filename}`);
  if (!manifestAsset) throw new Error(`Local release assets are missing ${MANIFEST_ASSET_NAME}`);

  const localTarballBytes = fs.readFile(tarball.path);
  const localIntegrity = sha512Integrity(localTarballBytes);
  if (localIntegrity !== expected.integrity) {
    throw new Error(
      `Local tarball integrity ${localIntegrity} does not match the candidate ${expected.integrity}`,
    );
  }
  const localManifestBytes = fs.readFile(manifestAsset.path);
  const localManifest = parseManifest(localManifestBytes, 'local release manifest');
  assertExpectedManifest(localManifest, { ...expected, tag, sha });

  const release = io.readRelease(tag);
  const plan = gitHubReleasePlan({
    tag,
    sha,
    release,
    assets: assets.map((asset) => ({
      name: asset.name,
      size: asset.size,
      byteIdentical: asset.name === expected.filename,
    })),
  });
  const names = assets.map((asset) => asset.name);

  const tmpDir = fs.mkdtemp('ranchbot-release.');
  let acceptedManifestBytes = null;
  try {
    // 1. Verify assets that already exist before uploading anything.
    if (!plan.create && plan.existing.length) {
      const dir = fs.mkdir(join(tmpDir, 'existing'));
      for (const name of plan.existing) {
        const path = io.downloadAsset({ tag, name, destDir: dir });
        const bytes = fs.readFile(path);
        if (name === expected.filename) {
          const integrity = sha512Integrity(bytes);
          if (integrity !== expected.integrity) {
            throw new Error(
              `Existing release asset ${name} has integrity ${integrity}, expected ${expected.integrity}`,
            );
          }
        } else if (name === MANIFEST_ASSET_NAME) {
          const remoteManifest = parseManifest(bytes, 'existing release manifest');
          compareManifests(localManifest, remoteManifest);
          acceptedManifestBytes = bytes;
        }
      }
    }

    // 2. Create a recoverable draft, or upload only the missing assets.
    const uploaded = new Set();
    if (plan.create) {
      io.createDraft({
        tag,
        sha,
        title,
        notesFile,
        assetPaths: assets.map((asset) => asset.path),
      });
      for (const name of names) uploaded.add(name);
    } else {
      for (const name of plan.upload) {
        io.uploadAsset(tag, byName.get(name).path);
        uploaded.add(name);
      }
    }

    // 3. Read back and verify every required asset before publishing.
    verifyRemoteAssets({
      io,
      fs,
      tag,
      dir: fs.mkdir(join(tmpDir, 'before-publish')),
      names,
      expected,
      localManifestBytes,
      acceptedManifestBytes,
      uploaded,
    });

    // 4. Publish only if the release is still a draft. Existing published
    //    releases keep their notes/title and only receive missing assets.
    const afterUpload = io.readRelease(tag);
    if (!afterUpload) {
      throw new Error(`GitHub release for ${tag} disappeared before publication`);
    }
    if (afterUpload.isPrerelease) {
      throw new Error(`Existing release for ${tag} is a prerelease; refusing to alter it`);
    }
    if (afterUpload.isDraft) io.publishDraft(tag);

    // 5. Final metadata and asset readback.
    const finalRelease = io.readRelease(tag);
    if (!finalRelease) throw new Error(`GitHub release for ${tag} was not found after publication`);
    if (finalRelease.isDraft) throw new Error(`GitHub release for ${tag} is still a draft`);
    if (finalRelease.isPrerelease)
      throw new Error(`GitHub release for ${tag} is still a prerelease`);
    assertReleaseIdentity({ tag, sha, release: finalRelease });
    verifyRemoteAssets({
      io,
      fs,
      tag,
      dir: fs.mkdir(join(tmpDir, 'final')),
      names,
      expected,
      localManifestBytes,
      acceptedManifestBytes,
      uploaded,
    });

    return { created: plan.create, uploaded: [...uploaded] };
  } finally {
    fs.removeDir(tmpDir);
  }
}

async function githubRelease() {
  const tag = flag('--tag');
  const sha = flag('--sha');
  const title = flag('--title', tag);
  const notesFile = flag('--notes-file');
  const version = flag('--version');
  const integrity = flag('--integrity');
  const filename = flag('--filename');
  const assetPaths = collectFlag('--asset');
  for (const [name, value] of [
    ['--tag', tag],
    ['--sha', sha],
    ['--notes-file', notesFile],
    ['--version', version],
    ['--integrity', integrity],
    ['--filename', filename],
  ]) {
    if (!value) throw new Error(`github-release requires ${name}`);
  }
  const assets = assetPaths.map((path) => ({
    name: basename(path),
    size: statSync(path).size,
    path,
  }));
  const result = await runGitHubRelease({
    io: createGitHubIo(),
    fs: workFs,
    tag,
    sha,
    title,
    notesFile,
    assets,
    expected: {
      repository: config.repository,
      packageName: config.packageName,
      version,
      integrity,
      filename,
    },
  });
  setOutput({ created: String(result.created), uploaded: result.uploaded.join(',') });
}

const commands = {
  gate,
  'validate-tag': validateTag,
  'check-tarball': checkTarball,
  'registry-status': registryStatus,
  'verify-registry': verifyRegistryEntry,
  'render-notes': renderNotes,
  'github-release': githubRelease,
};

const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const command = process.argv[2];
  if (!commands[command]) {
    throw new Error(`Usage: node scripts/release/main.mjs <${Object.keys(commands).join('|')}>`);
  }
  await commands[command]();
}
