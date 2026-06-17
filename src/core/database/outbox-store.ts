import localforage from 'localforage';
import type { OutboxEvent, OutboxEventStatus } from '../types/sync';

const outboxStore = localforage.createInstance({
  name: 'MeuGirassolDB',
  storeName: 'outbox',
  description: 'Fila de eventos para sincronização offline'
});

export const outbox = {
  async adicionar(event: Omit<OutboxEvent, 'id' | 'status' | 'retryCount' | 'createdAt' | 'updatedAt' | 'maxRetries'> & { maxRetries?: number }): Promise<OutboxEvent> {
    const id = `evt_${Date.now()}_${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).substring(2, 11)}`;
    const now = Date.now();
    const fullEvent: OutboxEvent = {
      ...event,
      maxRetries: event.maxRetries ?? 5,
      id,
      status: 'pending',
      retryCount: 0,
      createdAt: now,
      updatedAt: now
    };
    await outboxStore.setItem(id, fullEvent);
    return fullEvent;
  },

  async listarPorStatus(status: OutboxEventStatus): Promise<OutboxEvent[]> {
    const eventos: OutboxEvent[] = [];
    await outboxStore.iterate<OutboxEvent, void>((value) => {
      if (value.status === status) {
        eventos.push(value);
      }
    });
    return eventos.sort((a, b) => a.createdAt - b.createdAt);
  },

  async listarTodos(): Promise<OutboxEvent[]> {
    const eventos: OutboxEvent[] = [];
    await outboxStore.iterate<OutboxEvent, void>((value) => {
      eventos.push(value);
    });
    return eventos.sort((a, b) => a.createdAt - b.createdAt);
  },

  async contarPendentes(): Promise<number> {
    let count = 0;
    await outboxStore.iterate<OutboxEvent, void>((value) => {
      if (value.status === 'pending' || value.status === 'processing') {
        count++;
      }
    });
    return count;
  },

  async atualizarStatus(id: string, status: OutboxEventStatus): Promise<void> {
    const event = await outboxStore.getItem<OutboxEvent>(id);
    if (event) {
      await outboxStore.setItem(id, {
        ...event,
        status,
        updatedAt: Date.now()
      });
    }
  },

  async incrementarRetries(id: string): Promise<void> {
    const event = await outboxStore.getItem<OutboxEvent>(id);
    if (event) {
      await outboxStore.setItem(id, {
        ...event,
        retryCount: event.retryCount + 1,
        updatedAt: Date.now()
      });
    }
  },

  async obterPorId(id: string): Promise<OutboxEvent | null> {
    return outboxStore.getItem<OutboxEvent>(id);
  },

  async remover(id: string): Promise<void> {
    await outboxStore.removeItem(id);
  },

  async limparSincronizados(): Promise<void> {
    const keysToRemove: string[] = [];
    await outboxStore.iterate<OutboxEvent, void>((value, key) => {
      if (value.status === 'synced') {
        keysToRemove.push(key);
      }
    });
    for (const key of keysToRemove) {
      await outboxStore.removeItem(key);
    }
  }
};
