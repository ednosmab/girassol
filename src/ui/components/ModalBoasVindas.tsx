interface ModalBoasVindasProps {
  onFechar: () => void;
}

export function ModalBoasVindas({ onFechar }: ModalBoasVindasProps) {
  return (
    <div
      onClick={onFechar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000,
        padding: '20px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          borderRadius: '24px',
          padding: '35px 30px',
          maxWidth: '380px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          textAlign: 'center'
        }}
      >
        <p style={{
          fontSize: '2.5rem',
          margin: '0 0 10px'
        }}>
          😊🌻
        </p>
        <p style={{
          fontFamily: "'Caveat', cursive",
          fontSize: '1.6rem',
          fontWeight: 600,
          color: '#3C2A21',
          margin: '0 0 15px',
          lineHeight: 1.3
        }}>
          Ei, você aí!
        </p>
        <p style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: '0.95rem',
          color: '#555',
          lineHeight: 1.7,
          margin: '0 0 8px',
          textAlign: 'left'
        }}>
          Parece que é sua primeira vez por aqui.
          Deixa eu te contar como funciona:
        </p>
        <p style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: '0.95rem',
          color: '#555',
          lineHeight: 1.7,
          margin: '0 0 8px',
          textAlign: 'left'
        }}>
          Cada vez que cuidar do seu girassol,
          clique no botão da ação. O Calendário
          de Carinho vai anotar a data e te avisar
          quando for hora de cuidar de novo.
        </p>
        <p style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: '0.95rem',
          color: '#555',
          lineHeight: 1.7,
          margin: '0 0 20px',
          textAlign: 'left'
        }}>
          É como um diário, mas mais divertido!
          Prepare a regadera e mãos à obra! 💧
        </p>
        <button
          onClick={onFechar}
          style={{
            background: '#F2B705',
            color: '#3C2A21',
            border: 'none',
            padding: '14px 40px',
            borderRadius: '30px',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            transition: '0.3s'
          }}
        >
          Entendi!
        </button>
      </div>
    </div>
  );
}
