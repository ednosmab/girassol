import { useSync } from '../../core/contexts/SyncContext';

const mensagens: Record<string, string> = {
  offline: '📶 Sem internet. Continue registrando seus cuidados normalmente.',
  syncing: '⏳ Atualizando suas anotações...',
  synced: '✅ Tudo atualizado',
  error: '⚠️ Não foi possível atualizar. Tentaremos novamente.'
};

const icones: Record<string, string> = {
  offline: '📶',
  syncing: '⏳',
  synced: '✅',
  error: '⚠️'
};

export function SyncStatus() {
  const { syncState } = useSync();
  const { status, pendingEvents } = syncState;

  const podeOcultar = status === 'synced' && pendingEvents === 0;

  if (podeOcultar) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      padding: '8px 16px',
      background: status === 'offline' ? '#FFF3CD' : status === 'syncing' ? '#D1ECF1' : status === 'error' ? '#F8D7DA' : '#D4EDDA',
      color: status === 'offline' ? '#856404' : status === 'syncing' ? '#0C5460' : status === 'error' ? '#721C24' : '#155724',
      fontSize: '0.85rem',
      fontWeight: 600,
      textAlign: 'center',
      borderBottom: `2px solid ${status === 'offline' ? '#FFC107' : status === 'syncing' ? '#17A2B8' : status === 'error' ? '#DC3545' : '#28A745'}`,
      transition: 'all 0.3s ease'
    }}>
      <span>{icones[status]} {mensagens[status]}</span>
      {pendingEvents > 0 && status !== 'syncing' && (
        <span style={{ marginLeft: '8px', opacity: 0.8 }}>
          ({pendingEvents} pendente{pendingEvents > 1 ? 's' : ''})
        </span>
      )}
    </div>
  );
}
