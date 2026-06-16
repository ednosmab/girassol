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
