import { useState, useEffect, useRef } from 'react';
import {
  addDebugListener,
  clearDebugHistory,
  getDebugHistory,
  interceptConsole,
  listenSWMessages,
  addDebugLog,
  type DebugLogEntry
} from '../utils/debug-logger';

function swLog(level: DebugLogEntry['level'], msg: string) {
  addDebugLog(level, 'CHECK', msg);
}

async function checkSWStatus() {
  if (!('serviceWorker' in navigator)) {
    swLog('error', 'serviceWorker NÃO suportado neste navegador');
    return;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const active = reg.active;
    swLog('info', `SW active: ${!!active}, scope: ${reg.scope}`);
    if (active) {
      swLog('info', `SW scriptURL: ${active.scriptURL}`);
      swLog('info', `SW state: ${active.state}`);
    } else {
      swLog('warn', 'SW NÃO está ativo — isso pode impedir push notifications');
    }
  } catch (e) {
    swLog('error', `Erro ao verificar SW: ${(e as Error).message}`);
  }
}

async function checkPermission() {
  if (!('Notification' in window)) {
    swLog('error', 'API Notification NÃO suportada');
    return;
  }
  const perm = Notification.permission;
  swLog('info', `Notification.permission = "${perm}"`);
  if (perm === 'denied') {
    swLog('error', 'Permissão NEGADA — notificações bloqueadas pelo usuário');
  } else if (perm === 'default') {
    swLog('warn', 'Permissão DEFAULT — ainda não foi solicitada');
  } else {
    swLog('info', 'Permissão concedida OK');
  }
}

async function checkSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    swLog('error', 'PushManager NÃO suportado');
    return;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) {
      swLog('warn', 'Push subscription NÃO existe — nenhuma subscription ativa');
      return;
    }
    const json = sub.toJSON();
    const endpoint = json.endpoint || 'N/A';
    swLog('info', `Subscription endpoint: ${endpoint.substring(0, 80)}...`);
    if (json.keys) {
      swLog('info', `Keys: p256dh=${(json.keys as any).p256dh?.substring(0, 20)}..., auth=${(json.keys as any).auth?.substring(0, 10)}...`);
    }
    if (json.expirationTime) {
      const exp = new Date(json.expirationTime);
      const now = new Date();
      const daysLeft = Math.floor((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      swLog('info', `Expira em: ${exp.toLocaleString('pt-BR')} (${daysLeft} dias)`);
      if (daysLeft <= 0) {
        swLog('error', 'Subscription EXPIRADA!');
      } else if (daysLeft <= 7) {
        swLog('warn', `Subscription expira em breve (${daysLeft} dias)`);
      }
    }
  } catch (e) {
    swLog('error', `Erro ao verificar subscription: ${(e as Error).message}`);
  }
}

async function testLocalPush() {
  if (!('serviceWorker' in navigator)) {
    swLog('error', 'serviceWorker não suportado');
    return;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification('Teste Girassol', {
      body: 'Se você está vendo isso, notificações locais funcionam!',
      icon: '/icon-192.png',
      tag: 'debug-teste',
      vibrate: [200, 100, 200]
    } as NotificationOptions & { vibrate?: number[] });
    swLog('info', 'showNotification disparada com sucesso');
  } catch (e) {
    swLog('error', `showNotification FALHOU: ${(e as Error).message}`);
  }
}

async function checkAPI() {
  try {
    swLog('info', 'Testando conexão com /api/salvar-subscription (OPTIONS)...');
    const res = await fetch('/api/salvar-subscription', { method: 'OPTIONS' });
    swLog('info', `API respondeu: ${res.status} ${res.statusText}`);
  } catch (e) {
    swLog('error', `API FALHOU: ${(e as Error).message}`);
  }
}

const buttonStyle = {
  padding: '6px 10px',
  borderRadius: '8px',
  border: 'none',
  fontSize: '0.72rem',
  fontWeight: 700 as const,
  cursor: 'pointer' as const,
  whiteSpace: 'nowrap' as const
};

export function DebugLog() {
  const [logs, setLogs] = useState<DebugLogEntry[]>(getDebugHistory());
  const [isOpen, setIsOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    interceptConsole();
    listenSWMessages();
    return addDebugListener((entry) => {
      setLogs(prev => [...prev.slice(-199), entry]);
    });
  }, []);

  useEffect(() => {
    if (isOpen && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen]);

  const levelColor = (level: DebugLogEntry['level']) => {
    switch (level) {
      case 'error': return '#E63946';
      case 'warn': return '#D98E04';
      case 'sw': return '#9B5DE5';
      default: return '#40513B';
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => { setIsOpen(true); addDebugLog('info', 'APP', 'DebugLog aberto'); }}
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '16px',
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: '#3C2A21',
          color: '#F2B705',
          border: 'none',
          fontSize: '1.1rem',
          fontWeight: 700,
          cursor: 'pointer',
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        aria-label="Abrir logs de depuração"
      >
        D
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.92)',
      zIndex: 10001,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Courier New', monospace",
      fontSize: '0.7rem'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 12px',
        background: '#1a1a1a',
        borderBottom: '1px solid #333',
        flexShrink: 0
      }}>
        <span style={{ color: '#F2B705', fontWeight: 700, fontSize: '0.85rem' }}>
          Debug ({logs.length})
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => { clearDebugHistory(); setLogs([]); }}
            style={{ ...buttonStyle, background: '#E63946', color: 'white' }}
          >
            Limpar
          </button>
          <button
            onClick={() => setIsOpen(false)}
            style={{ ...buttonStyle, background: '#666', color: 'white' }}
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Check buttons */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        padding: '8px 12px',
        background: '#111',
        borderBottom: '1px solid #333',
        flexShrink: 0
      }}>
        <button onClick={checkSWStatus} style={{ ...buttonStyle, background: '#9B5DE5', color: 'white' }}>
          SW Status
        </button>
        <button onClick={checkPermission} style={{ ...buttonStyle, background: '#3A86FF', color: 'white' }}>
          Permissão
        </button>
        <button onClick={checkSubscription} style={{ ...buttonStyle, background: '#40513B', color: 'white' }}>
          Subscription
        </button>
        <button onClick={testLocalPush} style={{ ...buttonStyle, background: '#D98E04', color: 'white' }}>
          Teste Push
        </button>
        <button onClick={checkAPI} style={{ ...buttonStyle, background: '#E76F51', color: 'white' }}>
          Teste API
        </button>
      </div>

      {/* Log area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px',
        background: '#0a0a0a'
      }}>
        {logs.length === 0 && (
          <div style={{ color: '#555', textAlign: 'center', marginTop: '40px', fontSize: '0.8rem' }}>
            Nenhum log ainda.<br />
            Clique nos botões de cuidado ou nos checklists acima.
          </div>
        )}
        {logs.map(log => (
          <div key={log.id} style={{
            marginBottom: '3px',
            padding: '3px 6px',
            borderRadius: '3px',
            background: 'rgba(255,255,255,0.02)',
            borderLeft: `3px solid ${levelColor(log.level)}`
          }}>
            <span style={{ color: '#666' }}>{log.timestamp}</span>{' '}
            <span style={{ color: levelColor(log.level), fontWeight: 700 }}>[{log.source}]</span>{' '}
            <span style={{ color: '#ccc' }}>{log.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
