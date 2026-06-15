import { useState } from 'react';
import { obterPushSubscription } from '../../core/use-cases/notificacao-nativa';

export function TestarPush() {
  const [status, setStatus] = useState('');
  const [cronToken, setCronToken] = useState('');
  const [mostrarPainel, setMostrarPainel] = useState(false);

  const isDev = import.meta.env.DEV;
  const isTestMode = localStorage.getItem('girassol_test_mode') === 'true';
  const hasParam = new URLSearchParams(window.location.search).has('test');

  if (!isDev && !isTestMode && !hasParam) return null;

  const handleAgendarTeste = async (tipo: 'rega' | 'sol' | 'adubo') => {
    setStatus('Obtendo push subscription...');
    const subscription = await obterPushSubscription();
    if (!subscription) {
      setStatus('Erro: push subscription não disponível');
      return;
    }

    const dataDisparoCustom = new Date().toISOString();

    setStatus('Salvando lembrete...');
    const response = await fetch('/api/salvar-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo,
        subscription: subscription.toJSON(),
        timestamp: new Date().toISOString(),
        dataDisparoCustom
      })
    });

    if (!response.ok) {
      setStatus('Erro ao salvar no servidor');
      return;
    }

    const data = await response.json();
    setStatus(`Lembrete agendado para ${new Date(data.agendadoPara).toLocaleString('pt-BR')} — dispare o cron quando quiser!`);
  };

  const handleDispararCron = async () => {
    if (!cronToken) {
      setStatus('Cole o CRON_SECRET primeiro');
      return;
    }

    setStatus('Disparando cron...');
    const response = await fetch('/api/verificar-lembretes', {
      headers: { Authorization: `Bearer ${cronToken}` }
    });

    const data = await response.json();
    if (response.ok) {
      if (data.enviados > 0) {
        setStatus(`✅ Push enviado! Processados: ${data.processados}, Enviados: ${data.enviados}`);
      } else if (data.processados > 0) {
        setStatus(`⏰ Lembretes encontrados (${data.processados}) mas nenhum vencido. Verifique o KV.`);
      } else {
        setStatus(`📭 Nenhum lembrete encontrado no KV. Registre um cuidado primeiro.`);
      }
      if (data.erros && data.erros.length > 0) {
        setStatus(prev => `${prev}\n⚠️ Erros: ${data.erros.join(', ')}`);
      }
    } else {
      setStatus(`❌ Erro ${response.status}: ${data.error || response.statusText}`);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      right: '16px',
      zIndex: 9999
    }}>
      <button
        onClick={() => setMostrarPainel(!mostrarPainel)}
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: '#E63946',
          color: 'white',
          border: 'none',
          fontSize: '1.2rem',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(230,57,70,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        aria-label="Testar Push"
      >
        🧪
      </button>

      {mostrarPainel && (
        <div style={{
          position: 'absolute',
          bottom: '60px',
          right: 0,
          width: '300px',
          background: '#1a1a2e',
          color: '#eee',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#F2B705' }}>
            🧪 Testar Push
          </h3>

          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            {(['rega', 'sol', 'adubo'] as const).map((tipo) => (
              <button
                key={tipo}
                onClick={() => handleAgendarTeste(tipo)}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: '8px',
                  border: 'none',
                  background: tipo === 'rega' ? '#3A86FF' : tipo === 'sol' ? '#D98E04' : '#40513B',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                {tipo === 'rega' ? '💧' : tipo === 'sol' ? '☀️' : '🌱'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            <input
              type="password"
              placeholder="CRON_SECRET"
              value={cronToken}
              onChange={(e) => setCronToken(e.target.value)}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid #333',
                background: '#0f0f23',
                color: '#eee',
                fontSize: '0.8rem'
              }}
            />
            <button
              onClick={handleDispararCron}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                background: '#E63946',
                color: 'white',
                fontWeight: 700,
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              Disparar
            </button>
          </div>

          {status && (
            <p style={{
              margin: 0,
              fontSize: '0.75rem',
              color: '#aaa',
              background: '#0f0f23',
              padding: '8px',
              borderRadius: '8px',
              wordBreak: 'break-word'
            }}>
              {status}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
