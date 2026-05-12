import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(__dirname, '..');
const host = '127.0.0.1';

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function findRendererPort(startPort = 5173) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await isPortFree(port)) {
      return port;
    }
  }
  throw new Error(`No free renderer port found from ${startPort}`);
}

function run(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: clientDir,
    shell: process.platform === 'win32',
    stdio: 'inherit',
    ...options
  });
  return child;
}

function waitForUrl(url, timeoutMs = 30000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      http
        .get(url, (response) => {
          response.resume();
          resolve();
        })
        .on('error', () => {
          if (Date.now() - startedAt > timeoutMs) {
            reject(new Error(`Timed out waiting for ${url}`));
            return;
          }
          setTimeout(check, 500);
        });
    };
    check();
  });
}

const rendererPort = await findRendererPort(Number(process.env.PANDAO_RENDERER_PORT ?? 5173));
const rendererUrl = `http://${host}:${rendererPort}`;
const renderer = run('npm', [
  'run',
  'dev:renderer',
  '--',
  '--host',
  host,
  '--port',
  String(rendererPort)
]);

const shutdown = () => {
  renderer.kill();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  await waitForUrl(rendererUrl);

  const build = run('npm', ['run', 'build:electron']);
  await new Promise((resolve, reject) => {
    build.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Electron build failed with code ${code}`));
    });
  });

  const electron = run('npx', ['electron', '.'], {
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: rendererUrl
    }
  });

  electron.on('exit', (code) => {
    renderer.kill();
    process.exit(code ?? 0);
  });
} catch (error) {
  console.error(error);
  renderer.kill();
  process.exit(1);
}
