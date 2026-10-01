/**
 * Recovery-sequence tests for the release entrypoint. They exercise the
 * orchestration and ordering in `runGitHubRelease` with a fake `gh`/filesystem
 * adapter: no npm, network, credentials, or publication is involved.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import * as config from './config.mjs';
import { MANIFEST_ASSET_NAME, buildReleaseManifest, sha512Integrity } from './release.mjs';
import { runGitHubRelease } from './main.mjs';

const sha = 'a'.repeat(40);
const tag = 'v1.2.3';
const version = '1.2.3';
const filename = 'pkg-1.2.3.tgz';
const repository = config.repository;
const packageName = config.packageName;
const tarball = Buffer.from('tarball-bytes-for-1.2.3');
const integrity = sha512Integrity(tarball);

function manifest(overrides = {}) {
  return {
    ...buildReleaseManifest({
      repository,
      packageName,
      version,
      tag,
      sourceSha: sha,
      integrity,
      filename,
      runId: '42',
      runAttempt: '1',
      workflow: 'Release',
      workflowRef: `${repository}/.github/workflows/release.yml@refs/tags/${tag}`,
    }),
    ...overrides,
  };
}

function createHarness(options = {}) {
  const {
    localManifest = manifest(),
    localTarball = tarball,
    remote = null,
    login = 'ranchbot-dev',
    failUpload = false,
    failPublish = false,
    failDownload = false,
    publishNoop = false,
    publishSetsPrerelease = false,
    mutateManifestOnFinal = false,
    tamperUploadedManifest = false,
    dropAssetOnFinal = null,
  } = options;

  const calls = [];
  let cleanedUp = false;
  const localManifestBytes = Buffer.from(`${JSON.stringify(localManifest, null, 2)}\n`);
  const fileBytes = new Map([
    [`/assets/${filename}`, Buffer.from(localTarball)],
    ['/assets/release-manifest.json', localManifestBytes],
  ]);
  let counter = 0;
  let current = null;
  if (remote) {
    current = {
      tagName: remote.tagName ?? tag,
      targetCommitish: remote.targetCommitish ?? sha,
      isDraft: remote.isDraft ?? false,
      isPrerelease: remote.isPrerelease ?? false,
      assets: (remote.assets ?? []).map((asset) => ({
        name: asset.name,
        size: Buffer.from(asset.bytes).length,
      })),
    };
    for (const asset of remote.assets ?? []) {
      fileBytes.set(`/remote/${asset.name}`, Buffer.from(asset.bytes));
    }
  }

  const fs = {
    mkdtemp: (prefix) => `/tmp/${prefix}${counter++}`,
    mkdir: (dir) => dir,
    removeDir: () => {
      cleanedUp = true;
    },
    readFile: (path) => {
      if (!fileBytes.has(path)) throw new Error(`ENOENT: ${path}`);
      return fileBytes.get(path);
    },
  };

  const io = {
    assertIdentity() {
      calls.push({ op: 'identity' });
      return login;
    },
    readRelease() {
      calls.push({ op: 'readRelease' });
      if (!current) return null;
      return { ...current, assets: current.assets.map((asset) => ({ ...asset })) };
    },
    createDraft({ tag: draftTag, sha: draftSha, assetPaths }) {
      calls.push({ op: 'createDraft', names: assetPaths.map((path) => path.split('/').pop()) });
      current = {
        tagName: draftTag,
        targetCommitish: draftSha,
        isDraft: true,
        isPrerelease: false,
        assets: assetPaths.map((path) => ({
          name: path.split('/').pop(),
          size: fs.readFile(path).length,
        })),
      };
      for (const path of assetPaths) {
        fileBytes.set(`/remote/${path.split('/').pop()}`, fs.readFile(path));
      }
    },
    uploadAsset(_tag, path) {
      if (failUpload) throw new Error('upload failed');
      const name = path.split('/').pop();
      calls.push({ op: 'upload', name });
      const bytes =
        tamperUploadedManifest && name === MANIFEST_ASSET_NAME
          ? Buffer.from('{"tampered":true}\n')
          : fs.readFile(path);
      current.assets.push({ name, size: bytes.length });
      fileBytes.set(`/remote/${name}`, bytes);
    },
    downloadAsset({ name, destDir }) {
      calls.push({ op: 'download', name, dir: destDir });
      if (failDownload) throw new Error('download failed');
      if (!fileBytes.has(`/remote/${name}`)) throw new Error(`asset ${name} not found`);
      let bytes = fileBytes.get(`/remote/${name}`);
      if (mutateManifestOnFinal && name === MANIFEST_ASSET_NAME && destDir.includes('final')) {
        bytes = Buffer.from('{"mutated":true}\n');
        fileBytes.set(`/remote/${name}`, bytes);
      }
      if (dropAssetOnFinal && name === dropAssetOnFinal && destDir.includes('final')) {
        throw new Error(`asset ${name} missing on final readback`);
      }
      const path = `${destDir}/${name}`;
      fileBytes.set(path, bytes);
      return path;
    },
    publishDraft() {
      if (failPublish) throw new Error('publish failed');
      calls.push({ op: 'publish' });
      if (current && !publishNoop) {
        current.isDraft = false;
        if (publishSetsPrerelease) current.isPrerelease = true;
      }
    },
  };

  return {
    io,
    fs,
    calls,
    localManifestBytes,
    get cleanedUp() {
      return cleanedUp;
    },
  };
}

function run(harness, { localTarball = tarball } = {}) {
  const assets = [
    { name: filename, size: localTarball.length, path: `/assets/${filename}` },
    {
      name: MANIFEST_ASSET_NAME,
      size: harness.localManifestBytes.length,
      path: '/assets/release-manifest.json',
    },
  ];
  return runGitHubRelease({
    io: harness.io,
    fs: harness.fs,
    tag,
    sha,
    title: tag,
    notesFile: 'notes.md',
    assets,
    expected: { repository, packageName, version, integrity, filename },
  });
}

const ops = (calls) => calls.map((call) => call.op);

test('creates a draft, verifies assets, publishes, and reads back', async () => {
  const harness = createHarness();
  const result = await run(harness);
  assert.equal(result.created, true);
  assert.deepEqual(new Set(result.uploaded), new Set([filename, MANIFEST_ASSET_NAME]));
  const sequence = ops(harness.calls);
  assert.equal(sequence[0], 'identity');
  assert.ok(sequence.includes('createDraft'));
  assert.ok(sequence.includes('publish'));
  assert.equal(sequence[sequence.length - 1], 'download');
  assert.equal(sequence.filter((op) => op === 'publish').length, 1);
  // Asset verification happens before publication and again afterwards.
  const publishIndex = sequence.indexOf('publish');
  const downloads = sequence
    .map((op, index) => ({ op, index }))
    .filter((entry) => entry.op === 'download');
  assert.ok(downloads.some((entry) => entry.index < publishIndex));
  assert.ok(downloads.some((entry) => entry.index > publishIndex));
  assert.equal(harness.cleanedUp, true);
});

test('interrupted draft creation is recovered by uploading missing assets', async () => {
  const harness = createHarness({ remote: { isDraft: true, assets: [] } });
  const result = await run(harness);
  assert.equal(result.created, false);
  assert.deepEqual(ops(harness.calls).filter((op) => op === 'upload').length, 2);
  assert.equal(ops(harness.calls).includes('createDraft'), false);
  assert.equal(ops(harness.calls).includes('publish'), true);
});

test('partial draft uploads only the missing manifest and verifies the tarball', async () => {
  const harness = createHarness({
    remote: { isDraft: true, assets: [{ name: filename, bytes: tarball }] },
  });
  const result = await run(harness);
  assert.deepEqual(result.uploaded, [MANIFEST_ASSET_NAME]);
  const uploads = harness.calls.filter((call) => call.op === 'upload').map((call) => call.name);
  assert.deepEqual(uploads, [MANIFEST_ASSET_NAME]);
  assert.equal(ops(harness.calls).includes('publish'), true);
});

test('complete draft recovery skips uploads and publishes the draft', async () => {
  const harness = createHarness({
    remote: {
      isDraft: true,
      assets: [
        { name: filename, bytes: tarball },
        { name: MANIFEST_ASSET_NAME, bytes: Buffer.from(`${JSON.stringify(manifest())}\n`) },
      ],
    },
  });
  const result = await run(harness);
  assert.deepEqual(result.uploaded, []);
  assert.equal(ops(harness.calls).includes('upload'), false);
  assert.equal(ops(harness.calls).includes('createDraft'), false);
  assert.equal(ops(harness.calls).includes('publish'), true);
});

test('already-published release is a verified no-op with missing assets added', async () => {
  const harness = createHarness({
    remote: {
      isDraft: false,
      assets: [
        { name: filename, bytes: tarball },
        { name: MANIFEST_ASSET_NAME, bytes: Buffer.from(`${JSON.stringify(manifest())}\n`) },
      ],
    },
  });
  const result = await run(harness);
  assert.equal(result.created, false);
  assert.deepEqual(result.uploaded, []);
  assert.equal(ops(harness.calls).includes('publish'), false);
});

test('an upload failure stops before publication', async () => {
  const harness = createHarness({
    remote: { isDraft: true, assets: [] },
    failUpload: true,
  });
  await assert.rejects(run(harness), /upload failed/);
  assert.equal(ops(harness.calls).includes('publish'), false);
});

test('a publication failure rejects nonzero', async () => {
  const harness = createHarness({
    remote: {
      isDraft: true,
      assets: [
        { name: filename, bytes: tarball },
        { name: MANIFEST_ASSET_NAME, bytes: Buffer.from(`${JSON.stringify(manifest())}\n`) },
      ],
    },
    failPublish: true,
  });
  await assert.rejects(run(harness), /publish failed/);
});

test('a release that stays a draft after publication fails', async () => {
  const harness = createHarness({
    remote: {
      isDraft: true,
      assets: [
        { name: filename, bytes: tarball },
        { name: MANIFEST_ASSET_NAME, bytes: Buffer.from(`${JSON.stringify(manifest())}\n`) },
      ],
    },
    publishNoop: true,
  });
  await assert.rejects(run(harness), /still a draft/);
});

test('a release that becomes a prerelease after publication fails', async () => {
  const harness = createHarness({
    remote: {
      isDraft: true,
      assets: [
        { name: filename, bytes: tarball },
        { name: MANIFEST_ASSET_NAME, bytes: Buffer.from(`${JSON.stringify(manifest())}\n`) },
      ],
    },
    publishSetsPrerelease: true,
  });
  await assert.rejects(run(harness), /still a prerelease/);
});

test('an existing prerelease is rejected before any upload', async () => {
  const harness = createHarness({
    remote: {
      isDraft: false,
      isPrerelease: true,
      assets: [{ name: filename, bytes: tarball }],
    },
  });
  await assert.rejects(run(harness), /prerelease/);
  assert.equal(ops(harness.calls).includes('upload'), false);
});

test('an asset missing from the final readback fails', async () => {
  const harness = createHarness({
    remote: {
      isDraft: true,
      assets: [
        { name: filename, bytes: tarball },
        { name: MANIFEST_ASSET_NAME, bytes: Buffer.from(`${JSON.stringify(manifest())}\n`) },
      ],
    },
    dropAssetOnFinal: filename,
  });
  await assert.rejects(run(harness), /missing on final readback/);
});

test('equal-size tarball with different bytes fails before upload', async () => {
  const tampered = Buffer.from(tarball);
  tampered[0] ^= 0xff;
  const harness = createHarness({
    remote: {
      isDraft: true,
      assets: [{ name: filename, bytes: tampered }],
    },
  });
  await assert.rejects(run(harness), /integrity/);
  assert.equal(ops(harness.calls).includes('upload'), false);
  assert.equal(ops(harness.calls).includes('publish'), false);
});

test('an asset download failure fails closed before upload', async () => {
  const harness = createHarness({
    remote: { isDraft: true, assets: [{ name: filename, bytes: tarball }] },
    failDownload: true,
  });
  await assert.rejects(run(harness), /download failed/);
  assert.equal(ops(harness.calls).includes('upload'), false);
});

test('a conflicting existing manifest fails before upload', async () => {
  const conflicting = manifest({ sourceSha: 'b'.repeat(40) });
  const harness = createHarness({
    remote: {
      isDraft: true,
      assets: [
        { name: filename, bytes: tarball },
        { name: MANIFEST_ASSET_NAME, bytes: Buffer.from(`${JSON.stringify(conflicting)}\n`) },
      ],
    },
  });
  await assert.rejects(run(harness), /conflicts/);
  assert.equal(ops(harness.calls).includes('upload'), false);
});

test('a malformed existing manifest fails before upload', async () => {
  const harness = createHarness({
    remote: {
      isDraft: true,
      assets: [
        { name: filename, bytes: tarball },
        { name: MANIFEST_ASSET_NAME, bytes: Buffer.from('not json') },
      ],
    },
  });
  await assert.rejects(run(harness), /not valid JSON/);
  assert.equal(ops(harness.calls).includes('upload'), false);
});

test('a rerun with new run provenance preserves the original manifest bytes', async () => {
  const rerunManifest = manifest({ runId: '99', runAttempt: '2' });
  const rerunBytes = Buffer.from(`${JSON.stringify(rerunManifest)}\n`);
  const harness = createHarness({
    remote: {
      isDraft: true,
      assets: [
        { name: filename, bytes: tarball },
        { name: MANIFEST_ASSET_NAME, bytes: rerunBytes },
      ],
    },
  });
  const result = await run(harness);
  assert.deepEqual(result.uploaded, []);
  assert.equal(ops(harness.calls).includes('upload'), false);
  const manifestDownloads = harness.calls.filter(
    (call) => call.op === 'download' && call.name === MANIFEST_ASSET_NAME,
  );
  assert.ok(manifestDownloads.length >= 2, 'manifest is read back after publication');
});

test('formatting-only manifest differences are accepted without overwriting', async () => {
  const minified = Buffer.from(JSON.stringify(manifest()));
  const harness = createHarness({
    remote: {
      isDraft: true,
      assets: [
        { name: filename, bytes: tarball },
        { name: MANIFEST_ASSET_NAME, bytes: minified },
      ],
    },
  });
  const result = await run(harness);
  assert.deepEqual(result.uploaded, []);
});

test('an existing manifest changed after verification fails the final readback', async () => {
  const harness = createHarness({
    remote: {
      isDraft: true,
      assets: [
        { name: filename, bytes: tarball },
        { name: MANIFEST_ASSET_NAME, bytes: Buffer.from(`${JSON.stringify(manifest())}\n`) },
      ],
    },
    mutateManifestOnFinal: true,
  });
  await assert.rejects(run(harness), /changed during the release/);
});

test('a newly uploaded manifest that does not match the local bytes fails', async () => {
  const harness = createHarness({
    remote: { isDraft: true, assets: [{ name: filename, bytes: tarball }] },
    tamperUploadedManifest: true,
  });
  await assert.rejects(run(harness), /does not match the local candidate bytes/);
  assert.equal(ops(harness.calls).includes('publish'), false);
});

test('a local tarball that does not match the expected integrity fails immediately', async () => {
  const harness = createHarness({ localTarball: Buffer.from('different-bytes-in-local-tarball') });
  await assert.rejects(
    run(harness, { localTarball: Buffer.from('different-bytes-in-local-tarball') }),
    /does not match the candidate/,
  );
  assert.equal(ops(harness.calls).includes('createDraft'), false);
});

test('identity other than ranchbot-dev is rejected before any remote read', async () => {
  const harness = createHarness({ login: 'someone-else' });
  await assert.rejects(run(harness), /ranchbot-dev/);
  assert.deepEqual(ops(harness.calls), ['identity']);
});
