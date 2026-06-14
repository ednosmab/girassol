import { useState, useEffect } from 'react';
import { buscarHistorico, type HistoricoCuidados } from '../../core/use-cases/buscar-historico';

const tipoInfo: Record<string, { label: string; icone: string; cor: string }> = {
  rega: { label: 'Rega', icone: '💧', cor: '#3498db' },
  sol: { label: 'Sol', icone: '☀️', cor: '#f39c12' },
  adubo: { label: 'Adubo', icone: '🌱', cor: '#27ae60' }
};

export function CuidadosView() {
  const [historico, setHistorico] = useState<HistoricoCuidados | null>(null);

  useEffect(() => {
    const carregar = async () => {
      const dados = await buscarHistorico();
      setHistorico(dados);
    };
    carregar();
  }, []);

  const contarPorTipo = (tipo: string) => {
    return historico?.cuidados.filter(c => c.tipo === tipo).length || 0;
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{
        background: 'linear-gradient(135deg, #2d5016 0%, #4a7c24 100%)',
        borderRadius: '16px',
        padding: '1.5rem',
        color: '#fff',
        textAlign: 'center'
      }}>
        <h2 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: '1.3rem',
          margin: '0 0 0.5rem'
        }}>
          🌻 Resumo dos Cuidados
        </h2>
        <p style={{
          fontFamily: "'Caveat', cursive",
          fontSize: '1.1rem',
          margin: 0,
          opacity: 0.9
        }}>
          {historico?.totalRegistros || 0} cuidados registrados
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '0.75rem'
      }}>
        {Object.entries(tipoInfo).map(([tipo, info]) => (
          <div key={tipo} style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '1.25rem 0.75rem',
            textAlign: 'center',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            border: `2px solid ${info.cor}20`
          }}>
            <span style={{ fontSize: '2rem', display: 'block' }}>{info.icone}</span>
            <span style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.8rem',
              fontWeight: 700,
              color: info.cor,
              display: 'block',
              margin: '0.5rem 0'
            }}>
              {contarPorTipo(tipo)}
            </span>
            <span style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: '0.8rem',
              color: '#666'
            }}>
              {info.label}
            </span>
          </div>
        ))}
      </div>

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
            margin: '0 0 1rem'
          }}>
            📊 Histórico Completo
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {historico.cuidados.map((cuidado) => {
              const info = tipoInfo[cuidado.tipo];
              return (
                <div key={cuidado.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  borderRadius: '12px',
                  background: '#f8f6f0',
                  borderLeft: `4px solid ${info?.cor || '#ccc'}`
                }}>
                  <span style={{ fontSize: '1.5rem' }}>{info?.icone}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontWeight: 500,
                      color: '#333'
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

      {historico && historico.cuidados.length === 0 && (
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '2rem',
          textAlign: 'center',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
        }}>
          <span style={{ fontSize: '3rem', display: 'block' }}>🌱</span>
          <p style={{
            fontFamily: "'Caveat', cursive",
            fontSize: '1.2rem',
            color: '#666',
            margin: '1rem 0 0'
          }}>
            Nenhum cuidado registrado ainda. Comece registrando sua primeira ação!
          </p>
        </div>
      )}
    </div>
  );
}
