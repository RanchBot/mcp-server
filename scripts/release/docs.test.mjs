/**
 * Regression tests for the public-documentation validator. Most cases use an
 * in-memory file view so they fail for exactly one reason; one integration test
 * runs against the real package layout.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import * as config from './config.mjs';
import {
  analyzeDocumentLinks,
  assertExportCoversDocuments,
  assertPublicDocumentLinks,
  assertRequiredDocumentsPresent,
  assertTarballCoversDocuments,
  classifyLinkTarget,
  exportCoversDocument,
  extractMarkdownLinks,
  headingAnchors,
  parseGitArchiveAllowlist,
  resolveRelativeTarget,
  slugifyHeading,
  splitTarget,
} from './docs.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function virtualFiles(files) {
  const map = new Map(Object.entries(files));
  return {
    exists: (path) => map.has(path),
    readText: (path) => {
      if (!map.has(path)) throw new Error(`ENOENT: ${path}`);
      return map.get(path);
    },
  };
}

function check(documents, files) {
  const fs = virtualFiles(files);
  return assertPublicDocumentLinks({ root: '/virtual', documents, ...fs });
}

test('extracts inline links while ignoring fenced and inline code', () => {
  const markdown = [
    '# Title',
    '[guide](docs/guide.md)',
    '`[inline](docs/inline.md)`',
    '```',
    '[fenced](docs/fenced.md)',
    '```',
    '[titled](docs/title.md "Title")',
    '[angle](<docs/angle.md>)',
  ].join('\n');
  const links = extractMarkdownLinks(markdown);
  assert.deepEqual(
    links.map((link) => link.target),
    ['docs/guide.md', 'docs/title.md', 'docs/angle.md'],
  );
  assert.equal(links[0].line, 2);
  assert.equal(links[1].line, 7);
});

test('slugifies headings and disambiguates duplicates', () => {
  const anchors = headingAnchors(
    [
      '# A B',
      '## Farm selection errors',
      '### Farm selection errors',
      '## `ranchbot-mcp: command not found`, or the client cannot find it',
      '```',
      '## not a heading',
      '```',
    ].join('\n'),
  );
  assert.equal(slugifyHeading('A B!'), 'a-b');
  assert.ok(anchors.has('a-b'));
  assert.ok(anchors.has('farm-selection-errors'));
  assert.ok(anchors.has('farm-selection-errors-1'));
  assert.ok(anchors.has('ranchbot-mcp-command-not-found-or-the-client-cannot-find-it'));
  assert.equal(anchors.has('not-a-heading'), false);
});

test('classifies link targets without the network', () => {
  assert.deepEqual(classifyLinkTarget('#setup'), { kind: 'anchor', fragment: 'setup' });
  assert.deepEqual(classifyLinkTarget('mailto:support@ranch.bot'), { kind: 'mail' });
  assert.deepEqual(classifyLinkTarget('https://ranch.bot/docs/mcp-setup'), { kind: 'external' });
  assert.deepEqual(classifyLinkTarget('//example.com/x'), { kind: 'external' });
  assert.deepEqual(classifyLinkTarget('docs/guide.md'), { kind: 'relative' });
  assert.deepEqual(
    classifyLinkTarget('https://github.com/RanchBot/mcp-server/blob/main/docs/a.md'),
    {
      kind: 'internal',
      path: 'docs/a.md',
    },
  );
  assert.deepEqual(classifyLinkTarget('https://github.com/RanchBot/app/issues/1'), {
    kind: 'private',
  });
  assert.deepEqual(classifyLinkTarget('   '), { kind: 'empty' });
});

test('resolves relative targets and rejects escapes', () => {
  assert.deepEqual(
    resolveRelativeTarget({ documentPath: 'docs/guide.md', target: '../README.md' }),
    {
      path: 'README.md',
      fragment: '',
    },
  );
  assert.deepEqual(
    resolveRelativeTarget({ documentPath: 'README.md', target: 'docs/guide.md#setup' }),
    {
      path: 'docs/guide.md',
      fragment: 'setup',
    },
  );
  assert.match(
    resolveRelativeTarget({ documentPath: 'docs/guide.md', target: '../../secret.md' }).error,
    /escapes the package/,
  );
  assert.match(
    resolveRelativeTarget({ documentPath: 'README.md', target: '/etc/passwd' }).error,
    /absolute path/,
  );
  assert.deepEqual(splitTarget('docs/guide.md?x=1#setup'), {
    path: 'docs/guide.md',
    fragment: 'setup',
  });
});

test('every public document link and fragment resolves in the package', () => {
  assertPublicDocumentLinks({ root, documents: config.publicDocuments });
});

test('valid nested links, anchors, external and mail links pass', () => {
  assert.doesNotThrow(() =>
    check(['README.md'], {
      'README.md':
        '[guide](docs/guide.md#setup) [external](https://example.com/x) [mail](mailto:x@y.z) [top](#title)\n\n# Title\n',
      'docs/guide.md': '# Guide\n\n## Setup\n',
    }),
  );
});

test('missing documents and headings fail', () => {
  assert.throws(
    () => check(['README.md'], { 'README.md': '[x](docs/missing.md)' }),
    /missing target "docs\/missing\.md"/,
  );
  assert.throws(
    () =>
      check(['README.md'], {
        'README.md': '[x](docs/guide.md#nope)',
        'docs/guide.md': '# Guide\n',
      }),
    /missing heading "#nope"/,
  );
  assert.throws(
    () => check(['README.md', 'docs/gone.md'], { 'README.md': 'plain' }),
    /docs\/gone\.md: document is missing/,
  );
});

test('links that escape the package or reach the private monorepo fail', () => {
  const privateLink = 'https://github.com/RanchBot/app/issues/1';
  assert.throws(
    () => check(['docs/guide.md'], { 'docs/guide.md': '[x](../../docs/DECISIONS.md)' }),
    /escapes the package/,
  );
  assert.throws(
    () => check(['README.md'], { 'README.md': `[x](${privateLink})` }),
    /private monorepo/,
  );
  assert.throws(
    () => check(['README.md'], { 'README.md': '[x](PUBLISHING.md)' }),
    /private publishing document/,
  );
  assert.throws(
    () =>
      check(['README.md'], {
        'README.md': '[x](https://github.com/RanchBot/mcp-server/blob/main/../secret.md)',
      }),
    /escapes the package/,
  );
});

test('public repository documentation URLs resolve to local package files', () => {
  assert.doesNotThrow(() =>
    check(['README.md'], {
      'README.md': '[w](https://github.com/RanchBot/mcp-server/blob/main/docs/workflows.md)',
      'docs/workflows.md': '# Workflows\n',
    }),
  );
  assert.throws(
    () =>
      check(['README.md'], {
        'README.md': '[w](https://github.com/RanchBot/mcp-server/blob/main/docs/missing.md)',
      }),
    /missing target "docs\/missing\.md"/,
  );
});

test('analyzeDocumentLinks reports the offending line', () => {
  const problems = analyzeDocumentLinks({
    documentPath: 'README.md',
    text: 'line one\n[b](docs/missing.md)\n',
    ...virtualFiles({ 'README.md': '' }),
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^2: missing target/);
});

test('required documents must exist in the package view', () => {
  assert.doesNotThrow(() =>
    assertRequiredDocumentsPresent({ required: ['docs/a.md'], exists: () => true }),
  );
  assert.throws(
    () => assertRequiredDocumentsPresent({ required: ['docs/a.md'], exists: () => false }),
    /docs\/a\.md/,
  );
});

test('the release tarball must contain every required document', () => {
  assert.doesNotThrow(() =>
    assertTarballCoversDocuments({
      paths: ['docs/workflows.md', 'README.md'],
      requiredDocuments: ['docs/workflows.md'],
    }),
  );
  assert.throws(
    () =>
      assertTarballCoversDocuments({
        paths: ['README.md'],
        requiredDocuments: ['docs/workflows.md'],
      }),
    /docs\/workflows\.md/,
  );
});

test('parses and matches the documented source-export allowlist', () => {
  const allowlist = ['mcp-server/docs', 'mcp-server/CONTRIBUTING.md', 'mcp-server/SECURITY.md'];
  assert.doesNotThrow(() =>
    assertExportCoversDocuments({ allowlist, requiredDocuments: config.requiredDocuments }),
  );
  assert.throws(
    () =>
      assertExportCoversDocuments({
        allowlist: ['mcp-server/docs'],
        requiredDocuments: config.requiredDocuments,
      }),
    /CONTRIBUTING\.md/,
  );
  assert.equal(
    exportCoversDocument({ allowlist: ['mcp-server/docs'], document: 'docs/workflows.md' }),
    true,
  );

  const publishingText = [
    'git archive "$release_sha" \\',
    '  mcp-server/src mcp-server/scripts \\',
    '  mcp-server/docs mcp-server/CONTRIBUTING.md mcp-server/SECURITY.md \\',
    '  mcp-server/.gitignore | tar -x --strip-components=1 -C "$release_dir"',
  ].join('\n');
  assert.deepEqual(parseGitArchiveAllowlist(publishingText), [
    'mcp-server/src',
    'mcp-server/scripts',
    'mcp-server/docs',
    'mcp-server/CONTRIBUTING.md',
    'mcp-server/SECURITY.md',
    'mcp-server/.gitignore',
  ]);
  assert.throws(() => parseGitArchiveAllowlist('no export here'), /does not document/);
});

test('package config checks, ships, and exports every required document', () => {
  for (const document of config.requiredDocuments) {
    assert.ok(config.publicDocuments.includes(document), `${document} is link-checked`);
    assert.ok(
      config.tarball.requiredRootFiles.includes(document),
      `${document} is required in the tarball`,
    );
  }
  assertExportCoversDocuments({
    allowlist: config.sourceExport,
    requiredDocuments: config.requiredDocuments,
  });
  assertRequiredDocumentsPresent({
    required: config.requiredDocuments,
    exists: (path) => existsSync(join(root, path)),
  });
});

test('PUBLISHING.md and config.sourceExport agree when the private file is present', () => {
  const publishingPath = join(root, 'PUBLISHING.md');
  if (!existsSync(publishingPath)) return;
  const allowlist = parseGitArchiveAllowlist(readFileSync(publishingPath, 'utf8'));
  assert.deepEqual(allowlist, config.sourceExport);
});
