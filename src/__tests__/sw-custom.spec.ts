import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('sw-custom.js — handlers críticos', () => {
  const swPath = path.join(__dirname, '../../public/sw-custom.js');
  const source = fs.readFileSync(swPath, 'utf-8');

  it('deve registrar listener de message para SKIP_WAITING', () => {
    expect(source).toMatch(/addEventListener\(\s*['"]message['"]/);
    expect(source).toMatch(/SKIP_WAITING/);
    expect(source).toMatch(/self\.skipWaiting\(\)/);
  });

  it('deve manter handler de push existente', () => {
    expect(source).toMatch(/addEventListener\(\s*['"]push['"]/);
    expect(source).toMatch(/showNotification/);
  });

  it('deve manter handler de notificationclick existente', () => {
    expect(source).toMatch(/addEventListener\(\s*['"]notificationclick['"]/);
  });
});

describe('workbox build output — comportamento seguro', () => {
  const distSwPath = path.join(__dirname, '../../dist/sw.js');
  const distExists = fs.existsSync(distSwPath);

  (distExists ? it : it.skip)('sw.js gerado não deve auto-skipWaiting solto', () => {
    const buildSw = fs.readFileSync(distSwPath, 'utf-8');
    const matches = buildSw.match(/skipWaiting\s*\(\s*\)/g) || [];
    // O Workbox pode emitir seu próprio skipWaiting() em até 1 local
    // (handler de message do sw-custom). Não deve haver mais que isso.
    expect(matches.length).toBeLessThanOrEqual(1);
  });

  (distExists ? it : it.skip)('sw.js não deve chamar clientsClaim() no top-level', () => {
    const buildSw = fs.readFileSync(distSwPath, 'utf-8');
    expect(buildSw).not.toMatch(/^clientsClaim\s*\(\s*\)/m);
  });
});
