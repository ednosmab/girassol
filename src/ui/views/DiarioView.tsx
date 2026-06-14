import { useState, useEffect } from 'react';
import { registrarCuidado, type CuidadoInput } from '../../core/use-cases/registrar-cuidado';
import { buscarHistorico, type HistoricoCuidados } from '../../core/use-cases/buscar-historico';
import { AgendaBox } from '../components/AgendaBox';

const tiposCuidado = [
  { tipo: 'rega' as const, label: 'Rega', icone: '💧', cor: '#3498db' },
  { tipo: 'sol' as const, label: 'Sol', icone: '☀️', cor: '#f39c12' },
  { tipo: 'adubo' as const, label: 'Adubo', icone: '🌱', cor: '#27ae60' }
];

export function DiarioView() {
  const [historico, setHistorico] = useState<HistoricoCuidados | null>(null);
  const [mensagemFeedback, setMensagemFeedback] = useState<string>('');
  const [registrando, setRegistrando] = useState<string | null>(null);

  const carregarHistorico = async () => {
    const dados = await buscarHistorico();
    setHistorico(dados);
  };

  useEffect(() => {
    carregarHistorico();
  }, []);

  const handleRegistrar = async (tipo: CuidadoInput['tipo']) => {
    setRegistrando(tipo);
    try {
      await registrarCuidado({ tipo });
      setMensagemFeedback(`${tipo === 'rega' ? 'Rega' : tipo === 'sol' ? 'Sol' : 'Adubo'} registrado com sucesso!`);
      setTimeout(() => setMensagemFeedback(''), 3000);
      await carregarHistorico();
    } catch {
      setMensagemFeedback('Erro ao registrar cuidado');
      setTimeout(() => setMensagemFeedback(''), 3000);
    } finally {
      setRegistrando(null);
    }
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {mensagemFeedback && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '12px',
          background: mensagemFeedback.includes('sucesso') ? '#d4edda' : '#f8d7da',
          color: mensagemFeedback.includes('sucesso') ? '#155724' : '#721c24',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: '0.9rem',
          textAlign: 'center'
        }}>
          {mensagemFeedback}
        </div>
      )}

      <div style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '1.25rem',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        border: '1px solid #e8e4d9'
      }}>
        <h3 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: '1.1rem',
          color: '#2d5016',
          margin: '0 0 1rem'
        }}>
          🌿 Registrar Cuidado Agora
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.75rem'
        }}>
          {tiposCuidado.map(({ tipo, label, icone, cor }) => (
            <button
              key={tipo}
              onClick={() => handleRegistrar(tipo)}
              disabled={registrando !== null}
              aria-label={`Registrar ${label}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '1rem 0.5rem',
                border: 'none',
                borderRadius: '50px',
                background: registrando === tipo
                  ? `${cor}60`
                  : `linear-gradient(135deg, ${cor}, ${cor}cc)`,
                color: '#fff',
                cursor: registrando !== null ? 'wait' : 'pointer',
                transition: 'all 0.3s ease',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                boxShadow: `0 4px 12px ${cor}40`
              }}
            >
              <span style={{ fontSize: '2rem' }}>{icone}</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <AgendaBox onCuidadoRegistrado={carregarHistorico} />

      {historico && historico.cuidados.length > 0 && (
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '1.25rem',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          border: '1px solid #e8e4d9'
        }}>
          <h3 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '1.1rem',
            color: '#2d5016',
            margin: '0 0 0.5rem'
          }}>
            📋 Últimos Registros
          </h3>
          <p style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '0.8rem',
            color: '#888',
            margin: '0 0 1rem'
          }}>
            {historico.totalRegistros} registro(s) encontrado(s)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {historico.cuidados.slice(0, 5).map((cuidado) => {
              const info = tiposCuidado.find(t => t.tipo === cuidado.tipo);
              return (
                <div key={cuidado.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  borderRadius: '12px',
                  background: '#f8f6f0',
                  border: `2px solid ${info?.cor || '#ccc'}20`
                }}>
                  <span style={{ fontSize: '1.5rem' }}>{info?.icone}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontWeight: 500,
                      color: '#333',
                      fontSize: '0.9rem'
                    }}>
                      {info?.label}
                    </span>
                    <p style={{
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontSize: '0.75rem',
                      color: '#888',
                      margin: '0.125rem 0 0'
                    }}>
                      {cuidado.dataFormatada}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
