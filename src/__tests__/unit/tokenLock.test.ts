import * as fs from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import native = require('fs-native-extensions');
import { withTokenLock } from '../../tokenStorage';

describe('token lock failure and upgrade handling', () => {
  let directory: string;
  let lockFile: string;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(tmpdir(), 'ranchbot-lock-'));
    lockFile = path.join(directory, 'tokens.lock');
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const expectReleased = () => {
    const fd = fs.openSync(lockFile, 'a+');
    try {
      expect(native.tryLock(fd)).toBe(true);
    } finally {
      fs.closeSync(fd);
    }
  };
  it('releases ownership after a failed callback', async () => {
    await expect(
      withTokenLock(async () => {
        throw new Error('callback failed');
      }, lockFile),
    ).rejects.toThrow('callback failed');
    expectReleased();
  });
  it('reuses an abandoned legacy file without replacing its inode', async () => {
    fs.writeFileSync(lockFile, '2147483647:legacy');
    const inode = fs.statSync(lockFile).ino;
    await expect(withTokenLock(async () => 42, lockFile)).resolves.toBe(42);
    expect(fs.statSync(lockFile).ino).toBe(inode);
    expect(fs.readFileSync(lockFile, 'utf8')).toMatch(/^native-lock/);
    await expect(withTokenLock(async () => 43, lockFile)).resolves.toBe(43);
    expectReleased();
  });
  it('rejects a live legacy owner without running the callback or changing the file', async () => {
    const owner = `${process.pid}:legacy`;
    fs.writeFileSync(lockFile, owner);
    const callback = jest.fn();
    await expect(withTokenLock(callback, lockFile)).rejects.toThrow('stop older clients');
    expect(callback).not.toHaveBeenCalled();
    expect(fs.readFileSync(lockFile, 'utf8')).toBe(owner);
    expectReleased();
  });
  it('fails closed and closes the descriptor on native acquisition errors', async () => {
    const attempt = jest.spyOn(native, 'tryLock').mockImplementationOnce(() => {
      throw new Error('native acquisition failed');
    });
    const callback = jest.fn();
    await expect(withTokenLock(callback, lockFile)).rejects.toThrow('native acquisition failed');
    const fd = attempt.mock.calls[0][0];
    expect(() => fs.fstatSync(fd)).toThrow();
    expect(callback).not.toHaveBeenCalled();
    expectReleased();
  });
  it('times out after 30 seconds without disturbing the current owner', async () => {
    jest.useFakeTimers();
    const fd = fs.openSync(lockFile, 'a+');
    expect(native.tryLock(fd)).toBe(true);
    const callback = jest.fn();
    try {
      const result = expect(withTokenLock(callback, lockFile)).rejects.toThrow('Timed out');
      await jest.advanceTimersByTimeAsync(30_000);
      await result;
      expect(callback).not.toHaveBeenCalled();
      const probe = fs.openSync(lockFile, 'a+');
      try {
        expect(native.tryLock(probe)).toBe(false);
      } finally {
        fs.closeSync(probe);
      }
    } finally {
      fs.closeSync(fd);
    }
    expectReleased();
  });
});
