import localforage from 'localforage';

export interface Cuidado {
  id?: string;
  tipo: 'rega' | 'sol' | 'adubo';
  timestamp: string;
  dataFormatada: string;
  criadoEm: number;
}

export interface Lembrete {
  id?: string;
  titulo: string;
  mensagem: string;
  dataAgendada: string;
  ativo: boolean;
  criadoEm: number;
}

const cuidadoStore = localforage.createInstance({
  name: 'MeuGirassolDB',
  storeName: 'cuidados',
  description: 'Armazenamento de registros de cuidados com o girassol'
});

const lembreteStore = localforage.createInstance({
  name: 'MeuGirassolDB',
  storeName: 'lembretes',
  description: 'Armazenamento de lembretes agendados'
});

export const db = {
  cuidados: cuidadoStore,
  lembretes: lembreteStore
};

export function formatarDataPtBR(data: Date): string {
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function gerarIdUnico(): string {
  return `${Date.now()}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).substring(2, 11)}`;
}
