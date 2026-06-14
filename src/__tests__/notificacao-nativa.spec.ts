import { TitulosNotificacao, DescricoesNotificacao } from '../core/use-cases/notificacao-nativa';

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
