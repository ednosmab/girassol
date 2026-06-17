import { useState, useEffect, useRef } from 'react';
import { buscarHistorico } from '../../core/use-cases/buscar-historico';
import { obterProximoLembrete, obterTiposSemRegistro } from '../../core/use-cases/notificacao-nativa';
import { AgendaBox } from '../components/AgendaBox';
import { ModalBoasVindas } from '../components/ModalBoasVindas';
import { db, gerarIdUnico } from '../../core/database/localforage-db';

export function DiarioView() {
  const [textoLembrete, setTextoLembrete] = useState('');
  const [lembretes, setLembretes] = useState<{ id: string; titulo: string; criadoEm: number }[]>([]);
  const [proximos, setProximos] = useState<Record<string, string | null>>({});
  const [modalAberto, setModalAberto] = useState(false);

  const carregarHistorico = async () => {
    await buscarHistorico();
    setProximos({
      rega: await obterProximoLembrete('rega'),
      sol: await obterProximoLembrete('sol'),
      adubo: await obterProximoLembrete('adubo')
    });
  };

  const carregarLembretes = async () => {
    const items: { id: string; titulo: string; criadoEm: number }[] = [];
    await db.lembretes.iterate<{ id?: string; titulo: string; ativo: boolean; criadoEm: number }, void>((value) => {
      if (value.ativo) {
        items.push({ id: value.id!, titulo: value.titulo, criadoEm: value.criadoEm });
      }
    });
    setLembretes(items);
  };

  useEffect(() => {
    carregarHistorico();
    carregarLembretes();

    obterTiposSemRegistro().then((faltantes) => {
      const jaViu = localStorage.getItem('girassol_boas_vindas_visto');
      if (faltantes.length > 0 && !jaViu) {
        setModalAberto(true);
        localStorage.setItem('girassol_boas_vindas_visto', 'true');
      }
    });
  }, []);

  const textoRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = () => {
    const el = textoRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 100) + 'px';
  };

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
    if (textoRef.current) textoRef.current.style.height = 'auto';
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '15px' }}>
          <textarea
            ref={textoRef}
            value={textoLembrete}
            onChange={(e) => { setTextoLembrete(e.target.value); autoResize(); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                adicionarLembrete();
              }
            }}
            placeholder="Ex: Brotou uma folhinha nova hoje..."
            rows={1}
            style={{
              width: '100%',
              padding: '14px 20px',
              borderRadius: '16px',
              border: '1px solid #E0E0E0',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: '0.95rem',
              resize: 'none',
              overflow: 'hidden',
              minHeight: '48px',
              maxHeight: '100px',
              lineHeight: '1.5',
              boxSizing: 'border-box'
            }}
          />
          <button
            onClick={adicionarLembrete}
            style={{
              background: '#3C2A21',
              color: 'white',
              border: 'none',
              padding: '14px 24px',
              borderRadius: '16px',
              cursor: 'pointer',
              fontWeight: 600,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: '0.95rem',
              width: '100%'
            }}
          >
            Salvar Anotações
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
              <div style={{
                flex: 1,
                minWidth: 0
              }}>
                <span style={{
                  display: 'block',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word'
                }}>{item.titulo}</span>
                <span style={{
                  fontSize: '0.7rem',
                  color: '#999',
                  marginTop: '2px',
                  display: 'block'
                }}>
                  {new Date(item.criadoEm).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <button
                onClick={() => removerLembrete(item.id)}
                style={{
                  background: 'transparent',
                  border: '1.5px solid #E6394640',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: '#E63946',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  flexShrink: 0
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>

      {modalAberto && (
        <ModalBoasVindas onFechar={() => setModalAberto(false)} />
      )}
    </div>
  );
}
