import { dispararNotificacaoNativa, TitulosNotificacao, DescricoesNotificacao } from '../../core/use-cases/notificacao-nativa';

interface AgendaBoxProps {
  onCuidadoRegistrado?: () => void;
}

const tiposCuidado: { tipo: 'rega' | 'sol' | 'adubo'; label: string; icone: string; cor: string }[] = [
  { tipo: 'rega', label: 'Rega', icone: '💧', cor: '#3498db' },
  { tipo: 'sol', label: 'Sol', icone: '☀️', cor: '#f39c12' },
  { tipo: 'adubo', label: 'Adubo', icone: '🌱', cor: '#27ae60' }
];

export function AgendaBox({ onCuidadoRegistrado }: AgendaBoxProps) {
  const handleAgendar = async (tipo: 'rega' | 'sol' | 'adubo') => {
    await dispararNotificacaoNativa(
      TitulosNotificacao[tipo],
      DescricoesNotificacao[tipo]
    );
    onCuidadoRegistrado?.();
  };

  return (
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
        🔔 Notificar Cuidado
      </h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '0.75rem'
      }}>
        {tiposCuidado.map(({ tipo, label, icone, cor }) => (
          <button
            key={tipo}
            onClick={() => handleAgendar(tipo)}
            aria-label={`Notificar ${label}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '1rem 0.5rem',
              border: `2px solid ${cor}20`,
              borderRadius: '16px',
              background: `${cor}08`,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}
          >
            <span style={{
              fontSize: '2rem',
              width: '56px',
              height: '56px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              background: `${cor}15`
            }}>
              {icone}
            </span>
            <span style={{
              fontSize: '0.85rem',
              fontWeight: 500,
              color: '#333'
            }}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
