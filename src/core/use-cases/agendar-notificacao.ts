import { z } from 'zod';

export type TipoNotificacao = 'rega' | 'sol' | 'adubo';

export const TitulosNotificacao: Record<TipoNotificacao, string> = {
  rega: '💧 Cuidar do Girassol: Hora da Rega',
  sol: '☀️ Cuidar do Girassol: Banho de Sol',
  adubo: '🌱 Cuidar do Girassol: Nutrição e Adubo'
};

export const DescricoesNotificacao: Record<TipoNotificacao, string> = {
  rega: 'Verifique se a terra está seca a dois centímetros de profundidade antes de molhar.',
  sol: 'Garanta que ele pegue pelo menos 6 horas de luz solar direta hoje!',
  adubo: 'Dia de colocar o fertilizante rico em nitrogênio para crescer forte!'
};

export function gerarLinkCalendario(tipo: TipoNotificacao): string {
  const tipoSchema = z.enum(['rega', 'sol', 'adubo']);
  tipoSchema.parse(tipo);

  const titulo = encodeURIComponent(TitulosNotificacao[tipo]);
  const descricao = encodeURIComponent(DescricoesNotificacao[tipo]);

  return `https://www.google.com/calendar/render?action=TEMPLATE&text=${titulo}&details=${descricao}&location=Casa&sf=true&output=xml`;
}

export function agendarNotificacao(tipo: TipoNotificacao): string {
  return gerarLinkCalendario(tipo);
}
