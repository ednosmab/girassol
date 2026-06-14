import { z } from 'zod';
import { db, formatarDataPtBR, gerarIdUnico, type Cuidado } from '../database/localforage-db';

export const CuidadoInputSchema = z.object({
  tipo: z.enum(['rega', 'sol', 'adubo'], {
    errorMap: () => ({ message: 'Tipo de cuidado inválido. Use: rega, sol ou adubo' })
  })
});

export type CuidadoInput = z.infer<typeof CuidadoInputSchema>;

export async function registrarCuidado(input: CuidadoInput): Promise<Cuidado> {
  const validated = CuidadoInputSchema.parse(input);

  const agora = new Date();
  const cuidado: Cuidado = {
    id: gerarIdUnico(),
    tipo: validated.tipo,
    timestamp: agora.toISOString(),
    dataFormatada: formatarDataPtBR(agora),
    criadoEm: agora.getTime()
  };

  try {
    await db.cuidados.setItem(cuidado.id!, cuidado);
    return cuidado;
  } catch (error) {
    console.error('Erro ao registrar cuidado:', error);
    throw new Error('Falha ao persistir o registro de cuidado');
  }
}
