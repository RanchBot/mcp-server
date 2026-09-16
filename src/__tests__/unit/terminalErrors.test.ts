import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

it.each(['network', 'http'])(
  'keeps logout credentials private after a %s failure',
  async (failure) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-terminal-error-'));
    const refreshToken = 'rb_rt_synthetic_do_not_log';
    const accessToken = 'synthetic_access_do_not_log';
    const server = createServer((_req, res) => {
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ message: refreshToken }));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address() as { port: number };
    const api = `http://127.0.0.1:${address.port}`;
    if (failure === 'network') await new Promise<void>((resolve) => server.close(() => resolve()));
    const file = path.join(directory, '.ranchbot-mcp-tokens.json');
    const cache = JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: Date.now() + 900000,
      api_origin: api,
      client_id: 'ranchbot-mcp',
    });
    fs.writeFileSync(file, cache, { mode: 0o600 });
    try {
      const result = await new Promise<{
        code: number | string | null | undefined;
        stdout: string;
        stderr: string;
      }>((resolve) => {
        execFile(
          process.execPath,
          [
            '--require',
            require.resolve('tsx/cjs'),
            path.resolve(__dirname, '../../index.ts'),
            'logout',
          ],
          {
            cwd: directory,
            timeout: 15000,
            env: {
              HOME: directory,
              USERPROFILE: directory,
              PATH: process.env.PATH,
              SystemRoot: process.env.SystemRoot,
              RANCHBOT_API_URL: api,
              COGNITO_DEVICE_CLIENT_ID: 'ranchbot-mcp',
              RANCHBOT_DEPLOYMENT_MODE: 'cloud',
            },
          },
          (error, stdout, stderr) => resolve({ code: error?.code, stdout, stderr }),
        );
      });
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Authentication request failed');
      expect(result.stderr).toContain('Credentials remain');
      expect(result.stdout + result.stderr).not.toContain(refreshToken);
      expect(result.stdout + result.stderr).not.toContain(accessToken);
      expect(result.stdout + result.stderr).not.toContain('Signed out');
      expect(fs.readFileSync(file, 'utf8')).toBe(cache);
    } finally {
      if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
      fs.rmSync(directory, { recursive: true, force: true });
    }
  },
  20000,
);
