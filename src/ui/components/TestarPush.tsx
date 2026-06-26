import { useState } from 'react';
import { obterPushSubscription } from '../../core/use-cases/notificacao-nativa';

function isStaging(): boolean {
  return window.location.hostname.includes('staging');
}

export function TestarPush() {
  const [status, setStatus] = useState('');
  const [testToken, setTestToken] = useState('');
  const [mostrarPainel, setMostrarPainel] = useState(false);

  if (!isStaging()) return null;

  const callTestPush = async (body: Record<string, unknown>) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    // Em produção, envia o token de teste. Em dev, não precisa.
    if (!isStaging() && testToken) {
      headers['X-Test-Token'] = testToken;
    }
    const response = await fetch('/api/test-push', {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    return response;
  };

  const handleAgendarTeste = async (tipo: 'rega' | 'sol' | 'adubo') => {
    setStatus('Obtendo push subscription...');
    const subscription = await obterPushSubscription();
    if (!subscription) {
      setStatus('Erro: push subscription não disponível');
      return;
    }

    const dataDisparoCustom = new Date(Date.now() + 30_000).toISOString(); // 30s no futuro

    setStatus('Salvando lembrete...');
    const response = await callTestPush({
      action: 'agendar',
      tipo,
      subscription: subscription.toJSON(),
      timestamp: new Date().toISOString(),
      dataDisparoCustom
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setStatus(`Erro ${response.status}: ${err.error ?? response.statusText}`);
      return;
    }

    const data = await response.json();
    setStatus(`Agendado para ${new Date(data.agendadoPara).toLocaleString('pt-BR')}. Use o botão Disparar em ~30s.`);
  };

  const handleDispararCron = async () => {
    if (!isStaging() && !testToken) {
      setStatus('Em produção, cole o X-Test-Token primeiro.');
      return;
    }

    setStatus('Disparando...');
    const response = await callTestPush({ action: 'disparar' });
    const data = await response.json();

    if (!response.ok) {
      setStatus(`Erro ${response.status}: ${data.error ?? response.statusText}`);
      return;
    }

    if (data.enviados > 0) {
      setStatus(`✅ Enviados: ${data.enviados} | Apagados: ${data.apagados} | Total: ${data.totalVerificados}`);
    } else if (data.totalVerificados > 0) {
      setStatus(`⏰ ${data.totalVerificados} lembretes encontrados, nenhum vencido ainda.`);
    } else {
      setStatus('📭 Nenhum lembrete no KV. Agende um primeiro.');
    }
    if (data.erros?.length > 0) {
      setStatus((prev) => `${prev}\n⚠️ ${data.erros.join(', ')}`);
    }
  };

  const handleListar = async () => {
    setStatus('Listando...');
    const response = await callTestPush({ action: 'listar' });
    const data = await response.json();
    if (!response.ok) {
      setStatus(`Erro ${response.status}: ${data.error ?? response.statusText}`);
      return;
    }
    if (data.total === 0) {
      setStatus('📭 Nenhum lembrete no KV.');
    } else {
      const linhas = data.itens.map((i: any) =>
        `  ${i.tipo} → ${new Date(i.dataDisparo).toLocaleString('pt-BR')}${i.processado ? ' ✓' : ''}`
      );
      setStatus(`📋 ${data.total} lembretes:\n${linhas.join('\n')}`);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '80px', right: '16px', zIndex: 9999 }}>
      <button
        onClick={() => setMostrarPainel(!mostrarPainel)}
        style={{
          width: '48px', height: '48px', borderRadius: '50%',
          background: '#E63946', color: 'white', border: 'none',
          fontSize: '1.2rem', cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(230,57,70,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
        aria-label="Testar Push"
      >
        🧪
      </button>

      {mostrarPainel && (
        <div style={{
          position: 'absolute', bottom: '60px', right: 0,
          width: '320px', background: '#1a1a2e', color: '#eee',
          borderRadius: '16px', padding: '16px',
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
                  flex: 1, padding: '8px 4px', borderRadius: '8px', border: 'none',
                  background: tipo === 'rega' ? '#3A86FF' : tipo === 'sol' ? '#D98E04' : '#40513B',
                  color: 'white', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer'
                }}
              >
                {tipo === 'rega' ? '💧' : tipo === 'sol' ? '☀️' : '🌱'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            <button
              onClick={handleDispararCron}
              style={{
                flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                background: '#E63946', color: 'white', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer'
              }}
            >
              Disparar
            </button>
            <button
              onClick={handleListar}
              style={{
                flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                background: '#3A86FF', color: 'white', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer'
              }}
            >
              Listar
            </button>
          </div>

          {!isStaging() && (
            <input
              type="password"
              placeholder="X-Test-Token"
              value={testToken}
              onChange={(e) => setTestToken(e.target.value)}
              style={{
                width: '100%', padding: '8px', borderRadius: '8px',
                border: '1px solid #333', background: '#0f0f23', color: '#eee',
                fontSize: '0.8rem', marginBottom: '8px', boxSizing: 'border-box'
              }}
            />
          )}

          {status && (
            <pre style={{
              margin: 0, fontSize: '0.7rem', color: '#aaa',
              background: '#0f0f23', padding: '8px', borderRadius: '8px',
              wordBreak: 'break-word', whiteSpace: 'pre-wrap', maxHeight: '200px', overflow: 'auto'
            }}>
              {status}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
