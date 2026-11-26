import { app, BrowserWindow } from 'electron';
import express from 'express';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { createApp } from '@hnefatafl/backend';

const webDist = app.isPackaged
  ? path.join(process.resourcesPath, 'web')
  : path.resolve(import.meta.dirname, '../../web/dist');
const smokeTest = process.argv.includes('--smoke');

async function startServer(): Promise<string> {
  const server = express();
  server.use(createApp());
  server.use(express.static(webDist));

  return new Promise((resolve, reject) => {
    const listener = server.listen(0, '127.0.0.1', () => {
      const { port } = listener.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
    listener.on('error', reject);
  });
}

async function runSmokeTest(url: string): Promise<void> {
  const response = await fetch(`${url}/api/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'two-player' }),
  });
  if (response.status !== 201) throw new Error(`API returned ${response.status}`);
  const page = await fetch(url);
  if (!page.ok) throw new Error(`page returned ${page.status}`);
}

app.whenReady().then(async () => {
  const url = await startServer();

  const window = new BrowserWindow({
    width: 900,
    height: 900,
    title: 'Hnefatafl',
    webPreferences: { contextIsolation: true },
  });
  await window.loadURL(url);

  if (smokeTest) {
    try {
      await runSmokeTest(url);
      console.log('smoke test passed');
      app.exit(0);
    } catch (error) {
      console.error('smoke test failed:', error);
      app.exit(1);
    }
  }
});

app.on('window-all-closed', () => app.quit());
