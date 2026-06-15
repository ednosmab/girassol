import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { SyncState } from '../types/sync';
import { outbox } from '../database/outbox-store';

interface SyncContextValue {
  syncState: SyncState;
  triggerSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [syncState, setSyncState] = useState<SyncState>({
    status: navigator.onLine ? 'synced' : 'offline',
    pendingEvents: 0
  });

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine) {
      setSyncState(prev => ({ ...prev, status: 'offline' }));
      return;
    }

    setSyncState(prev => ({ ...prev, status: 'syncing' }));

    const pendentes = await outbox.listarPorStatus('pending');

    if (pendentes.length === 0) {
      setSyncState(prev => ({ ...prev, status: 'synced', pendingEvents: 0, lastSyncAt: Date.now() }));
      return;
    }

    let erros = 0;

    for (const evento of pendentes) {
      if (evento.retryCount >= evento.maxRetries) {
        await outbox.atualizarStatus(evento.id, 'failed');
        erros++;
        continue;
      }

      try {
        await outbox.atualizarStatus(evento.id, 'processing');

        const response = await fetch('/api/sync-events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            events: [{
              id: evento.id,
              type: evento.type,
              payload: evento.payload,
              idempotencyKey: evento.idempotencyKey
            }]
          })
        });

        if (response.ok) {
          await outbox.atualizarStatus(evento.id, 'synced');
        } else {
          await outbox.incrementarRetries(evento.id);
          await outbox.atualizarStatus(evento.id, 'pending');
          erros++;
        }
      } catch {
        await outbox.incrementarRetries(evento.id);
        await outbox.atualizarStatus(evento.id, 'pending');
        erros++;
      }
    }

    const pending = await outbox.contarPendentes();
    setSyncState({
      status: erros > 0 ? 'error' : 'synced',
      pendingEvents: pending,
      lastSyncAt: erros === 0 ? Date.now() : undefined
    });
  }, []);

  const atualizarEstado = useCallback(async () => {
    const pending = await outbox.contarPendentes();

    if (!navigator.onLine) {
      setSyncState(prev => ({ ...prev, status: 'offline', pendingEvents: pending }));
      return;
    }

    if (pending === 0) {
      setSyncState(prev => ({ ...prev, status: 'synced', pendingEvents: 0 }));
      return;
    }

    setSyncState(prev => ({ ...prev, status: 'syncing', pendingEvents: pending }));
    triggerSync();
  }, [triggerSync]);

  useEffect(() => {
    atualizarEstado();

    const handleOnline = () => {
      atualizarEstado();
      triggerSync();
    };

    const handleOffline = () => {
      setSyncState(prev => ({ ...prev, status: 'offline' }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(atualizarEstado, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [atualizarEstado, triggerSync]);

  return (
    <SyncContext.Provider value={{ syncState, triggerSync }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync deve ser usado dentro de SyncProvider');
  }
  return context;
}
