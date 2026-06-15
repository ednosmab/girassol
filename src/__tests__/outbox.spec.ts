import { outbox } from '../core/database/outbox-store';

beforeEach(async () => {
  await outbox.limparSincronizados();
  const todos = await outbox.listarTodos();
  for (const e of todos) {
    await outbox.remover(e.id);
  }
});

describe('outbox', () => {
  it('deve adicionar evento com status pending', async () => {
    const evento = await outbox.adicionar({
      type: 'care_registered',
      payload: { careType: 'rega', timestamp: Date.now() },
      idempotencyKey: 'test_001'
    });

    expect(evento.id).toMatch(/^evt_/);
    expect(evento.status).toBe('pending');
    expect(evento.retryCount).toBe(0);
    expect(evento.idempotencyKey).toBe('test_001');
  });

  it('deve listar eventos por status', async () => {
    await outbox.adicionar({
      type: 'care_registered',
      payload: { careType: 'rega', timestamp: Date.now() },
      idempotencyKey: 'test_002'
    });

    const pendentes = await outbox.listarPorStatus('pending');
    expect(pendentes.length).toBeGreaterThanOrEqual(1);
  });

  it('deve contar pendentes', async () => {
    const antes = await outbox.contarPendentes();

    await outbox.adicionar({
      type: 'care_registered',
      payload: { careType: 'sol', timestamp: Date.now() },
      idempotencyKey: 'test_003'
    });

    const depois = await outbox.contarPendentes();
    expect(depois).toBe(antes + 1);
  });

  it('deve atualizar status', async () => {
    const evento = await outbox.adicionar({
      type: 'care_registered',
      payload: { careType: 'adubo', timestamp: Date.now() },
      idempotencyKey: 'test_004'
    });

    await outbox.atualizarStatus(evento.id, 'processing');
    const atualizado = await outbox.obterPorId(evento.id);
    expect(atualizado?.status).toBe('processing');
  });

  it('deve incrementar retries', async () => {
    const evento = await outbox.adicionar({
      type: 'care_registered',
      payload: { careType: 'rega', timestamp: Date.now() },
      idempotencyKey: 'test_005'
    });

    await outbox.incrementarRetries(evento.id);
    await outbox.incrementarRetries(evento.id);
    const atualizado = await outbox.obterPorId(evento.id);
    expect(atualizado?.retryCount).toBe(2);
  });

  it('deve remover evento', async () => {
    const evento = await outbox.adicionar({
      type: 'care_registered',
      payload: { careType: 'rega', timestamp: Date.now() },
      idempotencyKey: 'test_006'
    });

    await outbox.remover(evento.id);
    const busca = await outbox.obterPorId(evento.id);
    expect(busca).toBeNull();
  });

  it('deve limpar sincronizados', async () => {
    const e1 = await outbox.adicionar({
      type: 'care_registered',
      payload: { careType: 'rega', timestamp: Date.now() },
      idempotencyKey: 'test_007'
    });
    await outbox.atualizarStatus(e1.id, 'synced');

    await outbox.limparSincronizados();
    const busca = await outbox.obterPorId(e1.id);
    expect(busca).toBeNull();
  });
});
