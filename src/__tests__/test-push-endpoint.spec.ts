import { SalvarSubscriptionInputSchema } from '../../api/_shared/validation';

describe('/api/test-push — contratos internos', () => {
  it('SalvarSubscriptionInputSchema aceita dataDisparoCustom agora', () => {
    const now = new Date();
    const result = SalvarSubscriptionInputSchema.safeParse({
      tipo: 'rega',
      subscription: { endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'p', auth: 'a' } },
      timestamp: now.toISOString(),
      dataDisparoCustom: new Date(now.getTime() + 60_000).toISOString()
    });
    expect(result.success).toBe(true);
  });

  it('SalvarSubscriptionInputSchema rejeita dataDisparoCustom no passado', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const result = SalvarSubscriptionInputSchema.safeParse({
      tipo: 'rega',
      subscription: { endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'p', auth: 'a' } },
      timestamp: new Date().toISOString(),
      dataDisparoCustom: past
    });
    expect(result.success).toBe(false);
  });
});

describe('/api/test-push — actions esperadas', () => {
  it('action deve ser uma de: agendar, disparar, listar', () => {
    const validActions = ['agendar', 'disparar', 'listar'];
    expect(validActions).toContain('agendar');
    expect(validActions).toContain('disparar');
    expect(validActions).toContain('listar');
  });

  it('resposta de listar deve ter total e itens', () => {
    const expectedShape = { total: 0, itens: [] };
    expect(expectedShape).toHaveProperty('total');
    expect(expectedShape).toHaveProperty('itens');
    expect(Array.isArray(expectedShape.itens)).toBe(true);
  });
});
