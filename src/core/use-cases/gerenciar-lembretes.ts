import { z } from 'zod';
import { db, formatarDataPtBR, gerarIdUnico, type Lembrete } from '../database/localforage-db';

export const LembreteInputSchema = z.object({
  titulo: z.string().min(1, 'Título é obrigatório').max(150, 'Título deve ter no máximo 150 caracteres'),
  mensagem: z.string().min(1, 'Mensagem é obrigatória').max(150, 'Mensagem deve ter no máximo 150 caracteres'),
  dataAgendada: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Data agendada inválida'
  })
});

export type LembreteInput = z.infer<typeof LembreteInputSchema>;

export async function criarLembrete(input: LembreteInput): Promise<Lembrete> {
  const validated = LembreteInputSchema.parse(input);

  const lembrete: Lembrete = {
    id: gerarIdUnico(),
    titulo: validated.titulo,
    mensagem: validated.mensagem,
    dataAgendada: formatarDataPtBR(new Date(validated.dataAgendada)),
    ativo: true,
    criadoEm: Date.now()
  };

  try {
    await db.lembretes.setItem(lembrete.id!, lembrete);
    return lembrete;
  } catch (error) {
    console.error('Erro ao criar lembrete:', error);
    throw new Error('Falha ao persistir o lembrete');
  }
}

export async function listarLembretes(): Promise<Lembrete[]> {
  try {
    const lembretes: Lembrete[] = [];

    await db.lembretes.iterate((value: Lembrete) => {
      if (value.ativo) {
        lembretes.push(value);
      }
    });

    return lembretes.sort((a, b) => a.criadoEm - b.criadoEm);
  } catch (error) {
    console.error('Erro ao listar lembretes:', error);
    return [];
  }
}

export async function removerLembrete(id: string): Promise<boolean> {
  try {
    const lembrete = await db.lembretes.getItem<Lembrete>(id);
    if (lembrete) {
      lembrete.ativo = false;
      await db.lembretes.setItem(id, lembrete);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Erro ao remover lembrete:', error);
    return false;
  }
}
