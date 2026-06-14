import { dispararNotificacaoNativa, TitulosNotificacao, DescricoesNotificacao } from '../../core/use-cases/notificacao-nativa';

interface AgendaBoxProps {
  onCuidadoRegistrado?: () => void;
}

const tiposCuidado: { tipo: 'rega' | 'sol' | 'adubo'; label: string; icone: string; cor: string; textoBotao: string }[] = [
  { tipo: 'rega', label: 'Rega', icone: '💧', cor: '#3A86FF', textoBotao: 'Registrei que Reguei Hoje' },
  { tipo: 'sol', label: 'Sol', icone: '☀️', cor: '#D98E04', textoBotao: 'Garanti as 6h de Sol Forte' },
  { tipo: 'adubo', label: 'Adubo', icone: '🌱', cor: '#40513B', textoBotao: 'Coloquei o Fertilizante' }
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
      background: '#FFFFFF',
      borderRadius: '30px',
      padding: '35px 25px',
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
        gap: '15px',
        marginBottom: '25px'
      }}>
        {tiposCuidado.map(({ tipo, label }) => (
          <div key={tipo} style={{
            background: '#FFFDF9',
            borderRadius: '20px',
            padding: '15px',
            textAlign: 'center',
            border: '1px solid rgba(0,0,0,0.05)'
          }}>
            <span style={{
              display: 'block',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#7A7A7A'
            }}>
              {label === 'Rega' ? 'Última Rega' : label === 'Sol' ? 'Banho de Sol' : 'Último Adubo'}
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
    </div>
  );
}
