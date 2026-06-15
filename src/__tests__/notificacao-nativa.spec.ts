import { TitulosNotificacao, DescricoesNotificacao, obterTiposSemRegistro } from '../core/use-cases/notificacao-nativa';
import { db } from '../core/database/localforage-db';

beforeEach(async () => {
  const keys = await db.cuidados.keys();
  for (const k of keys) await db.cuidados.removeItem(k);
});

describe('Sistema de Notificação Nativa', () => {
  it('deve conter títulos para todos os tipos de cuidado', () => {
    expect(TitulosNotificacao.rega).toContain('Rega');
    expect(TitulosNotificacao.sol).toContain('Sol');
    expect(TitulosNotificacao.adubo).toContain('Adubo');
  });

  it('deve conter descrições para todos os tipos de cuidado', () => {
    expect(DescricoesNotificacao.rega).toBeTruthy();
    expect(DescricoesNotificacao.sol).toBeTruthy();
    expect(DescricoesNotificacao.adubo).toBeTruthy();
  });

  it('deve ter chaves consistentes entre títulos e descrições', () => {
    const tipos = ['rega', 'sol', 'adubo'] as const;
    tipos.forEach((tipo) => {
      expect(TitulosNotificacao[tipo]).toBeDefined();
      expect(DescricoesNotificacao[tipo]).toBeDefined();
    });
  });

  it('deve conter emoji nos títulos', () => {
    expect(TitulosNotificacao.rega).toMatch(/\p{Emoji}/u);
    expect(TitulosNotificacao.sol).toMatch(/\p{Emoji}/u);
    expect(TitulosNotificacao.adubo).toMatch(/\p{Emoji}/u);
  });
});

describe('obterTiposSemRegistro', () => {
  it('deve retornar todos os tipos quando não há registros', async () => {
    const faltantes = await obterTiposSemRegistro();
    expect(faltantes).toEqual(['rega', 'sol', 'adubo']);
  });

  it('deve retornar apenas os tipos sem registro', async () => {
    await db.cuidados.setItem('test-1', {
      id: 'test-1',
      tipo: 'rega',
      timestamp: new Date().toISOString(),
      dataFormatada: '15/06/2026',
      criadoEm: Date.now()
    });

    const faltantes = await obterTiposSemRegistro();
    expect(faltantes).toEqual(['sol', 'adubo']);
  });

  it('deve retornar array vazio quando todos os tipos têm registro', async () => {
    const now = Date.now();
    await db.cuidados.setItem('r1', { id: 'r1', tipo: 'rega', timestamp: new Date().toISOString(), dataFormatada: '15/06/2026', criadoEm: now });
    await db.cuidados.setItem('s1', { id: 's1', tipo: 'sol', timestamp: new Date().toISOString(), dataFormatada: '15/06/2026', criadoEm: now });
    await db.cuidados.setItem('a1', { id: 'a1', tipo: 'adubo', timestamp: new Date().toISOString(), dataFormatada: '15/06/2026', criadoEm: now });

    const faltantes = await obterTiposSemRegistro();
    expect(faltantes).toEqual([]);
  });
});
