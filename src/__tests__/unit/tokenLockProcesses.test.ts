import { ChildProcess, fork } from 'child_process';
import { once } from 'events';
import * as fs from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { tryLock } from 'fs-native-extensions';

describe('native token lock crash recovery', () => {
  let directory: string;
  let children: ChildProcess[];
  const start = (barrier = false) => {
    const child = fork(
      path.resolve(__dirname, '../fixtures/lockWorker.ts'),
      [path.join(directory, 'tokens.lock'), barrier ? 'barrier' : ''],
      {
        cwd: directory,
        execArgv: ['--require', require.resolve('tsx/cjs')],
        env: {
          HOME: directory,
          USERPROFILE: directory,
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
          DOTENV_CONFIG_PATH: path.join(directory, '.env'),
        },
        stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      },
    );
    children.push(child);
    const messages: string[] = [];
    const waiters = new Map<string, () => void>();
    let stderr = '';
    child.stderr!.on('data', (data: Buffer) => {
      stderr += data.toString();
    });
    child.on('message', (message: string) => {
      messages.push(message);
      waiters.get(message)?.();
    });
    const wait = (message: string) =>
      messages.includes(message)
        ? Promise.resolve()
        : new Promise<void>((resolve) => waiters.set(message, resolve));
    const done = once(child, 'exit').then(([code]) => ({ code, stderr }));
    return { child, wait, done, messages };
  };
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(tmpdir(), 'ranchbot-native-lock-'));
    children = [];
  });
  afterEach(async () => {
    await Promise.all(
      children.map(async (child) => {
        if (child.exitCode === null && child.signalCode === null) {
          const exited = once(child, 'exit');
          child.kill('SIGKILL');
          await exited;
        }
      }),
    );
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it.each(['release', 'kill'])(
    'keeps two crash-recovery contenders exclusive after winner %s',
    async (ending) => {
      let holder = start();
      await holder.wait('entered');
      for (let round = 0; round < 2; round++) {
        const contenders = [start(true), start(true)];
        await Promise.all(contenders.map((worker) => worker.wait('contended')));
        holder.child.kill('SIGKILL');
        await holder.done;
        contenders.forEach((worker) => worker.child.send('go'));
        const winner = await Promise.race(
          contenders.map(async (worker) => {
            await worker.wait('entered');
            return worker;
          }),
        );
        const loser = contenders.find((worker) => worker !== winner)!;
        loser.child.send('probe');
        await loser.wait('probe:held');
        expect(loser.messages).not.toContain('entered');
        if (ending === 'release') winner.child.send('release');
        else winner.child.kill('SIGKILL');
        const result = await winner.done;
        if (ending === 'release') expect(result).toEqual({ code: 0, stderr: '' });
        await loser.wait('entered');
        holder = loser;
      }
      holder.child.send('release');
      expect(await holder.done).toEqual({ code: 0, stderr: '' });
      const fd = fs.openSync(path.join(directory, 'tokens.lock'), 'a+');
      try {
        expect(tryLock(fd)).toBe(true);
      } finally {
        fs.closeSync(fd);
      }
    },
    30_000,
  );
});
