import {
  SalvarSubscriptionInputSchema,
  SyncEventsInputSchema,
  parseOrReject
} from '../../api/_shared/validation';

describe('SalvarSubscriptionInputSchema', () => {
  const validInput = {
    tipo: 'rega' as const,
    subscription: {
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      keys: { p256dh: 'pubkey', auth: 'authsecret' }
    },
    timestamp: '2026-06-16T12:00:00.000Z'
  };

  it('deve aceitar input válido', () => {
    expect(SalvarSubscriptionInputSchema.safeParse(validInput).success).toBe(true);
  });

  it('deve rejeitar tipo inválido', () => {
    const result = SalvarSubscriptionInputSchema.safeParse({ ...validInput, tipo: 'poda' });
    expect(result.success).toBe(false);
  });

  it('deve rejeitar subscription sem endpoint URL', () => {
    const result = SalvarSubscriptionInputSchema.safeParse({
      ...validInput,
      subscription: { ...validInput.subscription, endpoint: 'nao-eh-url' }
    });
    expect(result.success).toBe(false);
  });

  it('deve rejeitar timestamp não-ISO', () => {
    const result = SalvarSubscriptionInputSchema.safeParse({ ...validInput, timestamp: 'ontem' });
    expect(result.success).toBe(false);
  });

  it('deve aceitar dataDisparoCustom no futuro próximo', () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const result = SalvarSubscriptionInputSchema.safeParse({
      ...validInput,
      dataDisparoCustom: future
    });
    expect(result.success).toBe(true);
  });

  it('deve rejeitar dataDisparoCustom no passado', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const result = SalvarSubscriptionInputSchema.safeParse({
      ...validInput,
      dataDisparoCustom: past
    });
    expect(result.success).toBe(false);
  });

  it('deve rejeitar dataDisparoCustom > 1 ano no futuro', () => {
    const far = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString();
    const result = SalvarSubscriptionInputSchema.safeParse({
      ...validInput,
      dataDisparoCustom: far
    });
    expect(result.success).toBe(false);
  });
});

describe('SyncEventsInputSchema', () => {
  it('deve aceitar array de eventos válidos', () => {
    const result = SyncEventsInputSchema.safeParse({
      events: [{
        id: 'evt_1',
        type: 'care_registered',
        payload: { foo: 'bar' },
        idempotencyKey: 'k1'
      }]
    });
    expect(result.success).toBe(true);
  });

  it('deve rejeitar array vazio', () => {
    expect(SyncEventsInputSchema.safeParse({ events: [] }).success).toBe(false);
  });

  it('deve rejeitar > 100 eventos', () => {
    const events = Array.from({ length: 101 }, (_, i) => ({
      id: `evt_${i}`,
      type: 'care_registered' as const,
      payload: {},
      idempotencyKey: `k${i}`
    }));
    expect(SyncEventsInputSchema.safeParse({ events }).success).toBe(false);
  });

  it('deve aceitar exatamente 100 eventos', () => {
    const events = Array.from({ length: 100 }, (_, i) => ({
      id: `evt_${i}`,
      type: 'care_registered' as const,
      payload: {},
      idempotencyKey: `k${i}`
    }));
    expect(SyncEventsInputSchema.safeParse({ events }).success).toBe(true);
  });

  it('deve rejeitar type desconhecido', () => {
    expect(SyncEventsInputSchema.safeParse({
      events: [{ id: 'e1', type: 'fake_type', payload: {}, idempotencyKey: 'k' }]
    }).success).toBe(false);
  });
});

describe('parseOrReject', () => {
  it('retorna ok:true para dado válido', () => {
    const r = parseOrReject(SalvarSubscriptionInputSchema, {
      tipo: 'rega',
      subscription: { endpoint: 'https://x.com', keys: { p256dh: 'p', auth: 'a' } },
      timestamp: new Date().toISOString()
    });
    expect(r.ok).toBe(true);
  });

  it('retorna ok:false + response com error para dado inválido', () => {
    const r = parseOrReject(SalvarSubscriptionInputSchema, { tipo: 'poda' });
    if (r.ok) throw new Error('esperava falha');
    expect(r.response.error).toBe('Dados inválidos');
    expect(r.response.details).toBeDefined();
  });
});
