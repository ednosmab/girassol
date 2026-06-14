import { LembreteInputSchema } from '../core/use-cases/gerenciar-lembretes';

describe('Schema de Validação de Lembrete', () => {
  it('deve aceitar lembrete válido', () => {
    const result = LembreteInputSchema.safeParse({
      titulo: 'Hora da Rega',
      mensagem: 'Verifique a umidade do solo',
      dataAgendada: new Date().toISOString()
    });
    expect(result.success).toBe(true);
  });

  it('deve rejeitar título vazio', () => {
    const result = LembreteInputSchema.safeParse({
      titulo: '',
      mensagem: 'Teste',
      dataAgendada: new Date().toISOString()
    });
    expect(result.success).toBe(false);
  });

  it('deve rejeitar título com mais de 150 caracteres', () => {
    const result = LembreteInputSchema.safeParse({
      titulo: 'a'.repeat(151),
      mensagem: 'Teste',
      dataAgendada: new Date().toISOString()
    });
    expect(result.success).toBe(false);
  });

  it('deve rejeitar mensagem com mais de 150 caracteres', () => {
    const result = LembreteInputSchema.safeParse({
      titulo: 'Teste',
      mensagem: 'a'.repeat(151),
      dataAgendada: new Date().toISOString()
    });
    expect(result.success).toBe(false);
  });

  it('deve rejeitar data inválida', () => {
    const result = LembreteInputSchema.safeParse({
      titulo: 'Teste',
      mensagem: 'Teste',
      dataAgendada: 'data-invalida'
    });
    expect(result.success).toBe(false);
  });
});
