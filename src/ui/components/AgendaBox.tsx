import { useState, useEffect } from 'react';
import { agendarLembrete, obterUltimoCuidado, verificarSuporteNotificacoes } from '../../core/use-cases/notificacao-nativa';
import { registrarCuidadoComOutbox } from '../../core/use-cases/registrar-cuidado-com-outbox';

interface AgendaBoxProps {
  onCuidadoRegistrado?: () => void;
}

const tiposCuidado: { tipo: 'rega' | 'sol' | 'adubo'; label: string; icone: string; cor: string; textoBotao: string }[] = [
  { tipo: 'rega', label: 'Rega', icone: '💧', cor: '#3A86FF', textoBotao: 'Registrei que Reguei Hoje' },
  { tipo: 'sol', label: 'Sol', icone: '☀️', cor: '#D98E04', textoBotao: 'Garanti as 6h de Sol Forte' },
  { tipo: 'adubo', label: 'Adubo', icone: '🌱', cor: '#40513B', textoBotao: 'Coloquei o Fertilizante' }
];

export function AgendaBox({ onCuidadoRegistrado }: AgendaBoxProps) {
  const [proximos, setProximos] = useState<Record<string, string | null>>({});
  const [permissaoStatus, setPermissaoStatus] = useState(verificarSuporteNotificacoes());
  const [mostrarDialogoPermissao, setMostrarDialogoPermissao] = useState(false);

  const carregarCountdowns = async () => {
    setProximos({
      rega: await obterUltimoCuidado('rega'),
      sol: await obterUltimoCuidado('sol'),
      adubo: await obterUltimoCuidado('adubo')
    });
  };

  useEffect(() => {
    carregarCountdowns();
  }, []);

  const handleAgendar = async (tipo: 'rega' | 'sol' | 'adubo') => {
    await registrarCuidadoComOutbox({ tipo });
    await carregarCountdowns();
    onCuidadoRegistrado?.();

    const status = verificarSuporteNotificacoes();
    setPermissaoStatus(status);

    if (status === 'denied') {
      setMostrarDialogoPermissao(true);
      return;
    }

    if (status === 'default') {
      setMostrarDialogoPermissao(true);
      return;
    }

    void agendarLembrete(tipo).catch((error) => {
      console.error('Falha ao agendar lembrete:', error);
    });
  };

  const handlePermitir = async () => {
    const status = verificarSuporteNotificacoes();
    if (status === 'denied') return;

    const granted = await new Promise<boolean>((resolve) => {
      const result = Notification.requestPermission();
      result.then((p) => resolve(p === 'granted'));
    });

    setMostrarDialogoPermissao(false);

    if (granted) {
      setPermissaoStatus('supported');
    } else {
      setPermissaoStatus(verificarSuporteNotificacoes());
    }
  };

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '30px',
      padding: '35px 16px',
      boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
      border: '2px dashed #F2B705'
    }}>
      <h2 style={{
        fontFamily: "'Caveat', cursive",
        fontSize: '2.6rem',
        fontWeight: 600,
        marginTop: 0,
        marginBottom: '5px',
        textAlign: 'center',
        color: '#3C2A21'
      }}>
        Calendário de Carinho
      </h2>
      <p style={{
        textAlign: 'center',
        marginTop: '-10px',
        color: '#666',
        fontSize: '0.95rem',
        marginBottom: '20px'
      }}>
        Clique nos botões toda vez que cuidar da sua plantinha para registrar a data!
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '10px',
        marginBottom: '25px'
      }}>
        {tiposCuidado.map(({ tipo, label, cor }) => (
          <div key={tipo} style={{
            background: '#FFFDF9',
            borderRadius: '20px',
            padding: '12px 8px',
            textAlign: 'center',
            border: '1px solid rgba(0,0,0,0.05)',
            minWidth: 0
          }}>
            <span style={{
              display: 'block',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: '#7A7A7A',
              whiteSpace: 'nowrap'
            }}>
              {label === 'Rega' ? 'Última Rega' : label === 'Sol' ? 'Banho de Sol' : 'Último Adubo'}
            </span>
            <span style={{
              display: 'block',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: proximos[tipo] === 'Vence hoje!' ? '#E63946' : cor,
              marginTop: '4px'
            }}>
              {proximos[tipo] || 'Sem agendamento'}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {tiposCuidado.map(({ tipo, icone, cor, textoBotao }) => (
          <button
            key={tipo}
            onClick={() => handleAgendar(tipo)}
            aria-label={`Registrar ${textoBotao}`}
            style={{
              width: '100%',
              background: cor,
              color: 'white',
              border: 'none',
              padding: '14px',
              fontSize: '1rem',
              fontWeight: 700,
              borderRadius: '40px 10px 40px 10px',
              cursor: 'pointer',
              transition: '0.3s',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {icone} {textoBotao}
          </button>
        ))}
      </div>

      {mostrarDialogoPermissao && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px'
          }}
          onClick={() => setMostrarDialogoPermissao(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '24px',
              padding: '28px 24px',
              maxWidth: '380px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
              textAlign: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔔</div>

            <h3 style={{
              fontFamily: "'Caveat', cursive",
              fontSize: '1.8rem',
              color: '#3C2A21',
              margin: '0 0 8px'
            }}>
              Lembretes no Celular
            </h3>

            {permissaoStatus === 'denied' ? (
              <>
                <p style={{ color: '#666', fontSize: '0.9rem', lineHeight: 1.5, margin: '0 0 16px' }}>
                  As notificações estão bloqueadas. Para ativar, acesse as configurações do navegador:
                </p>
                <div style={{
                  background: '#FFF8E1',
                  borderRadius: '12px',
                  padding: '12px',
                  textAlign: 'left',
                  fontSize: '0.82rem',
                  color: '#555',
                  lineHeight: 1.6,
                  marginBottom: '16px'
                }}>
                  <strong>Chrome/Edge:</strong> clique no ícone de configurações ⚙️ (ou "טין" 🔧) à esquerda da URL → Notificações → Permitir<br/>
                  <strong>Safari:</strong> Configurações → Sites → Notificações → Permitir<br/>
                  <strong>Firefox:</strong> clique no ícone de permissões à esquerda da URL → Permissões → Notificar → Permitir
                </div>
                <button
                  onClick={() => setMostrarDialogoPermissao(false)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    border: 'none',
                    background: '#F2B705',
                    color: '#3C2A21',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: 'pointer'
                  }}
                >
                  Entendi
                </button>
              </>
            ) : (
              <>
                <p style={{ color: '#666', fontSize: '0.9rem', lineHeight: 1.5, margin: '0 0 8px' }}>
                  Ative para receber lembretes de quando cuidar do seu Girassol:
                </p>
                <ul style={{
                  textAlign: 'left',
                  color: '#555',
                  fontSize: '0.85rem',
                  lineHeight: 1.8,
                  padding: '0 0 0 20px',
                  margin: '0 0 16px'
                }}>
                  <li>Rega a cada 2 dias</li>
                  <li>Sol todos os dias (6h)</li>
                  <li>Adubo a cada 15 dias</li>
                </ul>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setMostrarDialogoPermissao(false)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '12px',
                      border: '2px solid #ddd',
                      background: 'white',
                      color: '#666',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      cursor: 'pointer'
                    }}
                  >
                    Agora não
                  </button>
                  <button
                    onClick={handlePermitir}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '12px',
                      border: 'none',
                      background: '#40513B',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      cursor: 'pointer'
                    }}
                  >
                    Permitir
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
