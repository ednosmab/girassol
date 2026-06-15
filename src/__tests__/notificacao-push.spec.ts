import {
  obterProximoLembrete,
  TitulosNotificacao,
  DescricoesNotificacao
} from '../core/use-cases/notificacao-nativa';

beforeEach(() => {
  localStorage.clear();
});

describe('obterProximoLembrete', () => {
  it('deve retornar null quando não há registro', () => {
    expect(obterProximoLembrete('rega')).toBeNull();
    expect(obterProximoLembrete('sol')).toBeNull();
    expect(obterProximoLembrete('adubo')).toBeNull();
  });

  it('deve calcular 2 dias para rega', () => {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    localStorage.setItem('girassol_rega', ontem.toISOString());

    const resultado = obterProximoLembrete('rega');
    expect(resultado).toBe('1 dia(s)');
  });

  it('deve calcular 15 dias para adubo', () => {
    const hoje = new Date();
    localStorage.setItem('girassol_adubo', hoje.toISOString());

    const resultado = obterProximoLembrete('adubo');
    expect(resultado).toBe('15 dia(s)');
  });

  it('deve calcular 1 dia para sol', () => {
    const hoje = new Date();
    localStorage.setItem('girassol_sol', hoje.toISOString());

    const resultado = obterProximoLembrete('sol');
    expect(resultado).toBe('1 dia(s)');
  });

  it('deve retornar "Vence hoje!" quando a data já passou', () => {
    const tresDiasAtras = new Date();
    tresDiasAtras.setDate(tresDiasAtras.getDate() - 3);
    localStorage.setItem('girassol_rega', tresDiasAtras.toISOString());

    const resultado = obterProximoLembrete('rega');
    expect(resultado).toBe('Vence hoje!');
  });

  it('deve retornar "Vence hoje!" no dia exato do vencimento', () => {
    const doisDiasAtras = new Date();
    doisDiasAtras.setDate(doisDiasAtras.getDate() - 2);
    doisDiasAtras.setHours(0, 0, 0, 0);
    localStorage.setItem('girassol_rega', doisDiasAtras.toISOString());

    const resultado = obterProximoLembrete('rega');
    expect(resultado).toBe('Vence hoje!');
  });

  it('deve calcular corretamente para adubo com 10 dias restantes', () => {
    const cincoDiasAtras = new Date();
    cincoDiasAtras.setDate(cincoDiasAtras.getDate() - 5);
    localStorage.setItem('girassol_adubo', cincoDiasAtras.toISOString());

    const resultado = obterProximoLembrete('adubo');
    expect(resultado).toBe('10 dia(s)');
  });
});

describe('TitulosNotificacao', () => {
  it('deve conter títulos para todos os tipos', () => {
    expect(TitulosNotificacao.rega).toContain('Rega');
    expect(TitulosNotificacao.sol).toContain('Sol');
    expect(TitulosNotificacao.adubo).toContain('Adubo');
  });

  it('deve conter emoji nos títulos', () => {
    expect(TitulosNotificacao.rega).toMatch(/\p{Emoji}/u);
    expect(TitulosNotificacao.sol).toMatch(/\p{Emoji}/u);
    expect(TitulosNotificacao.adubo).toMatch(/\p{Emoji}/u);
  });
});

describe('DescricoesNotificacao', () => {
  it('deve conter descrições para todos os tipos', () => {
    expect(DescricoesNotificacao.rega).toBeTruthy();
    expect(DescricoesNotificacao.sol).toBeTruthy();
    expect(DescricoesNotificacao.adubo).toBeTruthy();
  });

  it('deve ter chaves consistentes com TitulosNotificacao', () => {
    const tipos = ['rega', 'sol', 'adubo'] as const;
    tipos.forEach((tipo) => {
      expect(TitulosNotificacao[tipo]).toBeDefined();
      expect(DescricoesNotificacao[tipo]).toBeDefined();
    });
  });
});
