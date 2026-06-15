import { db, type Cuidado, gerarIdUnico, formatarDataPtBR } from '../database/localforage-db';
import { outbox } from '../database/outbox-store';
import type { OutboxEventType } from '../types/sync';

interface RegistrarCuidadoInput {
  tipo: 'rega' | 'sol' | 'adubo';
}

interface RegistrarCuidadoOutput {
  cuidado: Cuidado;
  sincronizado: boolean;
}

export async function registrarCuidadoComOutbox(input: RegistrarCuidadoInput): Promise<RegistrarCuidadoOutput> {
  const now = new Date();
  const id = gerarIdUnico();

  const cuidado: Cuidado = {
    id,
    tipo: input.tipo,
    timestamp: now.toISOString(),
    dataFormatada: formatarDataPtBR(now),
    criadoEm: now.getTime()
  };

  await db.cuidados.setItem(id, cuidado);

  const tipoEvento: OutboxEventType = 'care_registered';

  await outbox.adicionar({
    type: tipoEvento,
    payload: {
      careType: input.tipo,
      timestamp: now.getTime(),
      localId: id
    },
    idempotencyKey: `care_${id}`
  });

  return {
    cuidado,
    sincronizado: false
  };
}
