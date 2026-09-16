import { tryLock } from 'fs-native-extensions';
import * as fs from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { withTokenLock } from '../../tokenStorage';

describe('withTokenLock', () => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(tmpdir(), 'ranchbot-mcp-lock-'));
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('runs concurrent callbacks one at a time', async () => {
    const lockFile = path.join(directory, 'tokens.lock');
    const events: string[] = [];
    let releaseFirst!: () => void;
    let markFirstEntered!: () => void;
    const holdFirst = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstEntered = new Promise<void>((resolve) => {
      markFirstEntered = resolve;
    });

    const first = withTokenLock(async () => {
      events.push('first:start');
      markFirstEntered();
      await holdFirst;
      events.push('first:end');
    }, lockFile);
    await firstEntered;
    const second = withTokenLock(async () => {
      events.push('second');
    }, lockFile);

    try {
      await new Promise((resolve) => setTimeout(resolve, 75));
      expect(events).toEqual(['first:start']);
    } finally {
      releaseFirst();
    }
    await Promise.all([first, second]);

    expect(events).toEqual(['first:start', 'first:end', 'second']);
    const probe = fs.openSync(lockFile, 'a+');
    try {
      expect(tryLock(probe)).toBe(true);
    } finally {
      fs.closeSync(probe);
    }
  });
});
