import { gerarLinkCalendario } from '../core/use-cases/agendar-notificacao';

describe('Motor de Geração de Links de Calendário', () => {
  it('deve gerar URL do Google Calendar com parâmetros corretos para rega', () => {
    const url = gerarLinkCalendario('rega');

    expect(url).toContain('action=TEMPLATE');
    expect(url).toContain('text=%F0%9F%92%A7');
    expect(url).toContain('output=xml');
    expect(url).toContain('location=Casa');
    expect(url).toContain('sf=true');
  });

  it('deve gerar URL válida para sol', () => {
    const url = gerarLinkCalendario('sol');

    expect(url).toContain('action=TEMPLATE');
    expect(url).toContain('text=');
    expect(url).toContain('details=');
  });

  it('deve gerar URL válida para adubo', () => {
    const url = gerarLinkCalendario('adubo');

    expect(url).toContain('action=TEMPLATE');
    expect(url).toContain('text=');
    expect(url).toContain('details=');
  });

  it('deve conter o domínio do Google Calendar', () => {
    const url = gerarLinkCalendario('rega');

    expect(url).toMatch(/^https:\/\/www\.google\.com\/calendar\/render/);
  });

  it('deve lançar erro para tipo inválido', () => {
    expect(() => {
      gerarLinkCalendario('invalido' as any);
    }).toThrow();
  });
});
