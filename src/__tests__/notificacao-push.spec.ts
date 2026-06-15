import { calcularDiasRestantes, TitulosNotificacao, DescricoesNotificacao } from '../core/use-cases/notificacao-nativa';

describe('calcularDiasRestantes', () => {
  it('deve calcular 2 dias para rega', () => {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    expect(calcularDiasRestantes(ontem.toISOString(), 'rega')).toBe('1 dia(s)');
  });

  it('deve calcular 15 dias para adubo', () => {
    const hoje = new Date();
    expect(calcularDiasRestantes(hoje.toISOString(), 'adubo')).toBe('15 dia(s)');
  });

  it('deve calcular 1 dia para sol', () => {
    const hoje = new Date();
    expect(calcularDiasRestantes(hoje.toISOString(), 'sol')).toBe('1 dia(s)');
  });

  it('deve retornar "Vence hoje!" quando a data já passou', () => {
    const tresDiasAtras = new Date();
    tresDiasAtras.setDate(tresDiasAtras.getDate() - 3);
    expect(calcularDiasRestantes(tresDiasAtras.toISOString(), 'rega')).toBe('Vence hoje!');
  });

  it('deve retornar "Vence hoje!" no dia exato do vencimento', () => {
    const doisDiasAtras = new Date();
    doisDiasAtras.setDate(doisDiasAtras.getDate() - 2);
    doisDiasAtras.setHours(0, 0, 0, 0);
    expect(calcularDiasRestantes(doisDiasAtras.toISOString(), 'rega')).toBe('Vence hoje!');
  });

  it('deve calcular corretamente para adubo com 10 dias restantes', () => {
    const cincoDiasAtras = new Date();
    cincoDiasAtras.setDate(cincoDiasAtras.getDate() - 5);
    expect(calcularDiasRestantes(cincoDiasAtras.toISOString(), 'adubo')).toBe('10 dia(s)');
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
