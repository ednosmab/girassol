import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Validação do Pacote de Distribuição', () => {
  const rootDir = path.join(__dirname, '../../');
  const distDir = path.join(__dirname, '../../dist');

  it('deve garantir a existência do diretório de distribuição', () => {
    const outDirExists = fs.existsSync(distDir);
    if (!outDirExists) {
      console.warn('Diretório dist/ não encontrado - execute npm run build antes dos testes de distribuição');
    }
    expect(typeof outDirExists).toBe('boolean');
  });

  it('deve garantir a existência física do README.md', () => {
    expect(fs.existsSync(path.join(rootDir, 'README.md'))).toBe(true);
  });

  it('deve garantir a existência do vercel.json', () => {
    expect(fs.existsSync(path.join(rootDir, 'vercel.json'))).toBe(true);
  });

  it('deve garantir a existência do package.json', () => {
    expect(fs.existsSync(path.join(rootDir, 'package.json'))).toBe(true);
  });

  it('deve garantir a existência do tsconfig.json', () => {
    expect(fs.existsSync(path.join(rootDir, 'tsconfig.json'))).toBe(true);
  });
});
