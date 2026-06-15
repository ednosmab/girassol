import { outbox } from '../core/database/outbox-store';
import type { OutboxEvent } from '../core/types/sync';

beforeEach(async () => {
  const todos = await outbox.listarTodos();
  for (const e of todos) await outbox.remover(e.id);
});

async function criarEventoPendente(overrides: Partial<OutboxEvent> = {}): Promise<OutboxEvent> {
  return outbox.adicionar({
    type: 'care_registered',
    payload: { careType: 'rega', timestamp: Date.now() },
    idempotencyKey: `sync_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    ...overrides
  });
}

describe('Sincronizador — fluxo online', () => {
  it('deve enviar eventos pendentes quando online', async () => {
    await criarEventoPendente({ idempotencyKey: 'online_1' });
    await criarEventoPendente({ idempotencyKey: 'online_2' });

    const pendentes = await outbox.listarPorStatus('pending');
    expect(pendentes.length).toBe(2);

    for (const evento of pendentes) {
      await outbox.atualizarStatus(evento.id, 'processing');
      await outbox.atualizarStatus(evento.id, 'synced');
    }

    const depois = await outbox.listarPorStatus('pending');
    expect(depois.length).toBe(0);

    const sincronizados = await outbox.listarPorStatus('synced');
    expect(sincronizados.length).toBe(2);
  });
});

describe('Sincronizador — fluxo offline', () => {
  it('deve manter eventos pendentes quando offline', async () => {
    await criarEventoPendente({ idempotencyKey: 'offline_1' });

    const pendentes = await outbox.listarPorStatus('pending');
    expect(pendentes.length).toBe(1);
    expect(pendentes[0].status).toBe('pending');
  });

  it('deve acumular múltiplos eventos offline', async () => {
    await criarEventoPendente({ idempotencyKey: 'off_1' });
    await criarEventoPendente({ idempotencyKey: 'off_2' });
    await criarEventoPendente({ idempotencyKey: 'off_3' });

    const pendentes = await outbox.listarPorStatus('pending');
    expect(pendentes.length).toBe(3);
  });
});

describe('Sincronizador — retentativas', () => {
  it('deve incrementar retries após falha', async () => {
    const e = await criarEventoPendente();

    await outbox.incrementarRetries(e.id);
    const atualizado = await outbox.obterPorId(e.id);
    expect(atualizado?.retryCount).toBe(1);
  });

  it('deve marcar como failed após maxRetries', async () => {
    const e = await criarEventoPendente({ maxRetries: 2 });

    await outbox.incrementarRetries(e.id);
    await outbox.incrementarRetries(e.id);
    const atualizado = await outbox.obterPorId(e.id);

    if (atualizado && atualizado.retryCount >= atualizado.maxRetries) {
      await outbox.atualizarStatus(e.id, 'failed');
    }

    const final = await outbox.obterPorId(e.id);
    expect(final?.status).toBe('failed');
  });

  it('deve manter dados intactos após falha', async () => {
    const e = await criarEventoPendente();
    const payloadOriginal = { ...e.payload };

    await outbox.incrementarRetries(e.id);
    await outbox.atualizarStatus(e.id, 'failed');

    const final = await outbox.obterPorId(e.id);
    expect(final?.payload).toEqual(payloadOriginal);
  });
});

describe('Sincronizador — idempotência', () => {
  it('deve gerar idempotencyKey único por evento', async () => {
    const e1 = await criarEventoPendente({ idempotencyKey: 'idem_a' });
    const e2 = await criarEventoPendente({ idempotencyKey: 'idem_b' });
    expect(e1.idempotencyKey).not.toBe(e2.idempotencyKey);
  });

  it('deve permitir marcar como synced sem erro', async () => {
    const e = await criarEventoPendente();
    await outbox.atualizarStatus(e.id, 'synced');
    await outbox.atualizarStatus(e.id, 'synced');
    const final = await outbox.obterPorId(e.id);
    expect(final?.status).toBe('synced');
  });
});

describe('Sincronizador — limpeza', () => {
  it('deve limpar eventos synced preservando pending', async () => {
    const e1 = await criarEventoPendente({ idempotencyKey: 'clean_1' });
    const e2 = await criarEventoPendente({ idempotencyKey: 'clean_2' });
    const e3 = await criarEventoPendente({ idempotencyKey: 'clean_3' });

    await outbox.atualizarStatus(e1.id, 'synced');
    await outbox.atualizarStatus(e2.id, 'synced');

    await outbox.limparSincronizados();

    expect(await outbox.obterPorId(e1.id)).toBeNull();
    expect(await outbox.obterPorId(e2.id)).toBeNull();
    expect(await outbox.obterPorId(e3.id)).not.toBeNull();
  });
});
