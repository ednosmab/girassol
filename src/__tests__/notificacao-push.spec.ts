import { calcularDiasRestantes, TitulosNotificacao, DescricoesNotificacao } from '../core/use-cases/notificacao-nativa';

function formatarDataBR(data: Date): string {
  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

describe('calcularDiasRestantes', () => {
  it('deve retornar a data futura para rega (2 dias)', () => {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const esperado = new Date();
    esperado.setDate(esperado.getDate() + 1);
    expect(calcularDiasRestantes(ontem.toISOString(), 'rega')).toBe(formatarDataBR(esperado));
  });

  it('deve retornar a data futura para adubo (15 dias)', () => {
    const hoje = new Date();
    const esperado = new Date();
    esperado.setDate(esperado.getDate() + 15);
    expect(calcularDiasRestantes(hoje.toISOString(), 'adubo')).toBe(formatarDataBR(esperado));
  });

  it('deve retornar a data futura para sol (1 dia)', () => {
    const hoje = new Date();
    const esperado = new Date();
    esperado.setDate(esperado.getDate() + 1);
    expect(calcularDiasRestantes(hoje.toISOString(), 'sol')).toBe(formatarDataBR(esperado));
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
    const esperado = new Date();
    esperado.setDate(esperado.getDate() + 10);
    expect(calcularDiasRestantes(cincoDiasAtras.toISOString(), 'adubo')).toBe(formatarDataBR(esperado));
  });

  it('deve respeitar o calendário do mês (jun 30 + 2 = jul 2)', () => {
    const jun30 = new Date(2026, 5, 30);
    const esperado = new Date(2026, 6, 2);
    expect(calcularDiasRestantes(jun30.toISOString(), 'rega')).toBe(formatarDataBR(esperado));
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
