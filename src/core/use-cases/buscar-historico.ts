import { db, type Cuidado } from '../database/localforage-db';

export interface HistoricoCuidados {
  cuidados: Cuidado[];
  totalRegistros: number;
  ultimaAtualizacao: string;
}

export async function buscarHistorico(): Promise<HistoricoCuidados> {
  try {
    const cuidados: Cuidado[] = [];

    await db.cuidados.iterate((value: Cuidado) => {
      cuidados.push(value);
    });

    cuidados.sort((a, b) => b.criadoEm - a.criadoEm);

    return {
      cuidados,
      totalRegistros: cuidados.length,
      ultimaAtualizacao: new Date().toISOString()
    };
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    return {
      cuidados: [],
      totalRegistros: 0,
      ultimaAtualizacao: new Date().toISOString()
    };
  }
}
