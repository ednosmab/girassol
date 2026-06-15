import { outbox } from '../core/database/outbox-store';
import type { OutboxEvent } from '../core/types/sync';

beforeEach(async () => {
  const todos = await outbox.listarTodos();
  for (const e of todos) {
    await outbox.remover(e.id);
  }
});

async function criarEvento(overrides: Partial<OutboxEvent> = {}): Promise<OutboxEvent> {
  return outbox.adicionar({
    type: 'care_registered',
    payload: { careType: 'rega', timestamp: Date.now() },
    idempotencyKey: `test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    ...overrides
  });
}

describe('outbox — criação e persistência', () => {
  it('deve criar evento com status pending', async () => {
    const evento = await criarEvento();
    expect(evento.id).toMatch(/^evt_/);
    expect(evento.status).toBe('pending');
    expect(evento.retryCount).toBe(0);
    expect(evento.maxRetries).toBe(5);
  });

  it('deve gerar idempotencyKey único', async () => {
    const e1 = await criarEvento({ idempotencyKey: 'key_a' });
    const e2 = await criarEvento({ idempotencyKey: 'key_b' });
    expect(e1.idempotencyKey).not.toBe(e2.idempotencyKey);
  });

  it('deve persistir e recuperar por id', async () => {
    const evento = await criarEvento();
    const recuperado = await outbox.obterPorId(evento.id);
    expect(recuperado).not.toBeNull();
    expect(recuperado?.id).toBe(evento.id);
  });
});

describe('outbox — filtragem por status', () => {
  it('deve listar apenas pendentes', async () => {
    await criarEvento({ idempotencyKey: 'k1' });
    await criarEvento({ idempotencyKey: 'k2' });
    const pendentes = await outbox.listarPorStatus('pending');
    expect(pendentes.length).toBe(2);
    pendentes.forEach(e => expect(e.status).toBe('pending'));
  });

  it('deve listar apenas sincronizados', async () => {
    const e = await criarEvento();
    await outbox.atualizarStatus(e.id, 'synced');
    const syncs = await outbox.listarPorStatus('synced');
    expect(syncs.length).toBe(1);
    expect(syncs[0].status).toBe('synced');
  });

  it('deve retornar vazio quando não há eventos com status específico', async () => {
    await criarEvento();
    const failed = await outbox.listarPorStatus('failed');
    expect(failed.length).toBe(0);
  });
});

describe('outbox — contagem', () => {
  it('deve contar pendentes corretamente', async () => {
    const antes = await outbox.contarPendentes();
    await criarEvento({ idempotencyKey: 'c1' });
    await criarEvento({ idempotencyKey: 'c2' });
    const depois = await outbox.contarPendentes();
    expect(depois).toBe(antes + 2);
  });

  it('deve contar processing como pendente', async () => {
    const e = await criarEvento();
    await outbox.atualizarStatus(e.id, 'processing');
    const count = await outbox.contarPendentes();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('deve contar synced como 0 pendentes', async () => {
    const e = await criarEvento();
    await outbox.atualizarStatus(e.id, 'synced');
    const pendentes = await outbox.listarPorStatus('pending');
    const syncs = await outbox.listarPorStatus('synced');
    expect(pendentes.length).toBe(0);
    expect(syncs.length).toBe(1);
  });
});

describe('outbox — atualização de status', () => {
  it('deve atualizar de pending para processing', async () => {
    const e = await criarEvento();
    await outbox.atualizarStatus(e.id, 'processing');
    const atualizado = await outbox.obterPorId(e.id);
    expect(atualizado?.status).toBe('processing');
  });

  it('deve atualizar de processing para synced', async () => {
    const e = await criarEvento();
    await outbox.atualizarStatus(e.id, 'processing');
    await outbox.atualizarStatus(e.id, 'synced');
    const atualizado = await outbox.obterPorId(e.id);
    expect(atualizado?.status).toBe('synced');
  });

  it('deve atualizar de pending para failed', async () => {
    const e = await criarEvento();
    await outbox.atualizarStatus(e.id, 'failed');
    const atualizado = await outbox.obterPorId(e.id);
    expect(atualizado?.status).toBe('failed');
  });
});

describe('outbox — retentativas', () => {
  it('deve incrementar retryCount', async () => {
    const e = await criarEvento();
    await outbox.incrementarRetries(e.id);
    const atualizado = await outbox.obterPorId(e.id);
    expect(atualizado?.retryCount).toBe(1);
  });

  it('deve incrementar múltiplas vezes', async () => {
    const e = await criarEvento();
    await outbox.incrementarRetries(e.id);
    await outbox.incrementarRetries(e.id);
    await outbox.incrementarRetries(e.id);
    const atualizado = await outbox.obterPorId(e.id);
    expect(atualizado?.retryCount).toBe(3);
  });
});

describe('outbox — remoção e limpeza', () => {
  it('deve remover evento específico', async () => {
    const e = await criarEvento();
    await outbox.remover(e.id);
    const busca = await outbox.obterPorId(e.id);
    expect(busca).toBeNull();
  });

  it('deve limpar apenas sincronizados', async () => {
    const e1 = await criarEvento({ idempotencyKey: 's1' });
    const e2 = await criarEvento({ idempotencyKey: 's2' });
    const e3 = await criarEvento({ idempotencyKey: 'p1' });

    await outbox.atualizarStatus(e1.id, 'synced');
    await outbox.atualizarStatus(e2.id, 'synced');

    await outbox.limparSincronizados();

    expect(await outbox.obterPorId(e1.id)).toBeNull();
    expect(await outbox.obterPorId(e2.id)).toBeNull();
    expect(await outbox.obterPorId(e3.id)).not.toBeNull();
  });
});

describe('outbox — ordenação cronológica', () => {
  it('deve listar eventos ordenados por createdAt crescente', async () => {
    const e1 = await criarEvento({ idempotencyKey: 'ord_1' });
    await new Promise(r => setTimeout(r, 10));
    const e2 = await criarEvento({ idempotencyKey: 'ord_2' });

    const todos = await outbox.listarTodos();
    const ids = todos.map(e => e.id);
    expect(ids.indexOf(e1.id)).toBeLessThan(ids.indexOf(e2.id));
  });
});
