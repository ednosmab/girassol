import { useState, useEffect } from 'react';
import { buscarHistorico } from '../../core/use-cases/buscar-historico';
import { AgendaBox } from '../components/AgendaBox';

export function DiarioView() {
  const [textoLembrete, setTextoLembrete] = useState('');
  const [lembretes, setLembretes] = useState<string[]>([]);

  const carregarHistorico = async () => {
    await buscarHistorico();
  };

  useEffect(() => {
    carregarHistorico();
    const salvos = localStorage.getItem('girassol_lembretes');
    if (salvos) setLembretes(JSON.parse(salvos));
  }, []);

  const adicionarLembrete = () => {
    const texto = textoLembrete.trim();
    if (!texto) return;
    const novos = [...lembretes, texto];
    setLembretes(novos);
    localStorage.setItem('girassol_lembretes', JSON.stringify(novos));
    setTextoLembrete('');
  };

  const removerLembrete = (index: number) => {
    const novos = lembretes.filter((_, i) => i !== index);
    setLembretes(novos);
    localStorage.setItem('girassol_lembretes', JSON.stringify(novos));
  };

  return (
    <div style={{ padding: '0 20px', marginTop: '-40px', position: 'relative', zIndex: 10 }}>
      <AgendaBox onCuidadoRegistrado={carregarHistorico} />

      <div style={{
        background: '#FFFFFF',
        borderRadius: '30px',
        padding: '30px',
        boxShadow: '0 15px 40px rgba(60, 42, 33, 0.04)',
        borderLeft: '8px solid #40513B',
        marginTop: '30px'
      }}>
        <h3 style={{
          fontFamily: "'Caveat', cursive",
          fontSize: '1.8rem',
          fontWeight: 600,
          color: '#40513B',
          marginTop: 0,
          marginBottom: '15px'
        }}>
          📝 Anotações e Lembretes Importantes
        </h3>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <input
            type="text"
            value={textoLembrete}
            onChange={(e) => setTextoLembrete(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && adicionarLembrete()}
            placeholder="Ex: Brotou uma folhinha nova hoje..."
            style={{
              flex: 1,
              padding: '12px 20px',
              borderRadius: '20px',
              border: '1px solid #E0E0E0',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: '0.95rem'
            }}
          />
          <button
            onClick={adicionarLembrete}
            style={{
              background: '#3C2A21',
              color: 'white',
              border: 'none',
              padding: '0 20px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontWeight: 600,
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}
          >
            Salvar
          </button>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {lembretes.map((item, index) => (
            <li key={index} style={{
              background: '#FFFDF9',
              padding: '12px 20px',
              borderRadius: '15px',
              marginBottom: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.95rem',
              borderLeft: '4px solid #F2B705'
            }}>
              <span>{item}</span>
              <button
                onClick={() => removerLembrete(index)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#E63946',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '1rem'
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
