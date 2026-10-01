import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PACKAGE_VERSION, readPackageVersion } from '../../version';

describe('package version', () => {
  it('matches package.json in the package root', () => {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, '..', '..', '..', 'package.json'), 'utf8'),
    ) as { version: string };
    expect(PACKAGE_VERSION).toBe(pkg.version);
    expect(PACKAGE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('rejects missing, malformed, and non-stable metadata', () => {
    expect(() => readPackageVersion(join(tmpdir(), 'missing-package.json'))).toThrow(
      /Unable to read package metadata/,
    );

    const dir = mkdtempSync(join(tmpdir(), 'mcp-version-'));
    try {
      const malformed = join(dir, 'malformed.json');
      writeFileSync(malformed, '{ not json');
      expect(() => readPackageVersion(malformed)).toThrow(/not valid JSON/);

      for (const version of ['latest', '0.1', '^0.1.1', 7]) {
        const path = join(dir, 'package.json');
        writeFileSync(path, JSON.stringify({ version }));
        expect(() => readPackageVersion(path)).toThrow(/no stable version/);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
