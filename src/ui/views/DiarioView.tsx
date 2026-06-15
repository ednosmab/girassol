import { useState, useEffect } from 'react';
import { buscarHistorico } from '../../core/use-cases/buscar-historico';
import { obterProximoLembrete } from '../../core/use-cases/notificacao-nativa';
import { AgendaBox } from '../components/AgendaBox';
import { db, gerarIdUnico } from '../../core/database/localforage-db';

export function DiarioView() {
  const [textoLembrete, setTextoLembrete] = useState('');
  const [lembretes, setLembretes] = useState<{ id: string; titulo: string }[]>([]);
  const [proximos, setProximos] = useState<Record<string, string | null>>({});

  const carregarHistorico = async () => {
    await buscarHistorico();
    setProximos({
      rega: await obterProximoLembrete('rega'),
      sol: await obterProximoLembrete('sol'),
      adubo: await obterProximoLembrete('adubo')
    });
  };

  const carregarLembretes = async () => {
    const items: { id: string; titulo: string }[] = [];
    await db.lembretes.iterate<{ id?: string; titulo: string; ativo: boolean }, void>((value) => {
      if (value.ativo) {
        items.push({ id: value.id!, titulo: value.titulo });
      }
    });
    setLembretes(items);
  };

  useEffect(() => {
    carregarHistorico();
    carregarLembretes();
  }, []);

  const adicionarLembrete = async () => {
    const texto = textoLembrete.trim();
    if (!texto) return;
    const id = gerarIdUnico();
    await db.lembretes.setItem(id, {
      id,
      titulo: texto,
      mensagem: '',
      dataAgendada: new Date().toISOString(),
      ativo: true,
      criadoEm: Date.now()
    });
    setTextoLembrete('');
    await carregarLembretes();
  };

  const removerLembrete = async (id: string) => {
    const lembrete = await db.lembretes.getItem(id);
    if (lembrete) {
      await db.lembretes.setItem(id, { ...lembrete, ativo: false });
    }
    await carregarLembretes();
  };

  return (
    <div style={{ padding: '0 20px', marginTop: '-40px', position: 'relative', zIndex: 10 }}>
      <AgendaBox onCuidadoRegistrado={carregarHistorico} />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '10px',
        marginTop: '20px'
      }}>
        {[
          { tipo: 'rega', label: 'Próxima Rega', icone: '💧', cor: '#3A86FF' },
          { tipo: 'sol', label: 'Próximo Sol', icone: '☀️', cor: '#D98E04' },
          { tipo: 'adubo', label: 'Próximo Adubo', icone: '🌱', cor: '#40513B' }
        ].map(({ tipo, label, icone, cor }) => (
          <div key={tipo} style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            padding: '12px 8px',
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            border: `2px solid ${cor}20`
          }}>
            <span style={{ fontSize: '1.2rem' }}>{icone}</span>
            <p style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: '0.7rem',
              fontWeight: 600,
              color: '#7A7A7A',
              margin: '4px 0 2px'
            }}>
              {label}
            </p>
            <p style={{
              fontFamily: "'Caveat', cursive",
              fontSize: '1rem',
              fontWeight: 600,
              color: proximos[tipo] === 'Vence hoje!' ? '#E63946' : cor,
              margin: 0
            }}>
              {proximos[tipo] || 'Sem agendamento'}
            </p>
          </div>
        ))}
      </div>

      <div style={{
        background: '#FFFFFF',
        borderRadius: '30px',
        padding: '30px',
        boxShadow: '0 15px 40px rgba(60, 42, 33, 0.04)',
        borderLeft: '8px solid #40513B',
        marginTop: '20px'
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
          {lembretes.map((item) => (
            <li key={item.id} style={{
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
              <span>{item.titulo}</span>
              <button
                onClick={() => removerLembrete(item.id)}
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
