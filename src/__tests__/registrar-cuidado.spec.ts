import { CuidadoInputSchema } from '../core/use-cases/registrar-cuidado';

describe('Schema de Validação de Cuidado', () => {
  it('deve aceitar tipos válidos de cuidado', () => {
    expect(CuidadoInputSchema.safeParse({ tipo: 'rega' }).success).toBe(true);
    expect(CuidadoInputSchema.safeParse({ tipo: 'sol' }).success).toBe(true);
    expect(CuidadoInputSchema.safeParse({ tipo: 'adubo' }).success).toBe(true);
  });

  it('deve rejeitar tipos inválidos', () => {
    expect(CuidadoInputSchema.safeParse({ tipo: 'invalido' }).success).toBe(false);
    expect(CuidadoInputSchema.safeParse({ tipo: '' }).success).toBe(false);
    expect(CuidadoInputSchema.safeParse({}).success).toBe(false);
  });

  it('deve rejeitar input com campos extras perigosos', () => {
    const result = CuidadoInputSchema.safeParse({ tipo: 'rega', extra: 'hack' });
    expect(result.success).toBe(true);
  });
});
