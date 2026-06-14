interface NavigationProps {
  abaAtiva: string;
  onTrocarAba: (aba: string) => void;
}

const abas = [
  { id: 'diario', label: 'Diário', icon: '📝' },
  { id: 'cuidados', label: 'Cuidados', icon: '🌿' },
  { id: 'agenda', label: 'Agenda', icon: '📅' }
];

export function Navigation({ abaAtiva, onTrocarAba }: NavigationProps) {
  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'center',
      gap: '0.5rem',
      padding: '0.75rem 1rem',
      background: '#fefdf5',
      borderBottom: '2px solid #e8e4d9',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      {abas.map((aba) => (
        <button
          key={aba.id}
          onClick={() => onTrocarAba(aba.id)}
          aria-label={`Navegar para ${aba.label}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.6rem 1.2rem',
            border: 'none',
            borderRadius: '50px',
            background: abaAtiva === aba.id
              ? 'linear-gradient(135deg, #2d5016, #4a7c24)'
              : 'transparent',
            color: abaAtiva === aba.id ? '#fff' : '#5a6b4a',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: abaAtiva === aba.id ? 600 : 400,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: abaAtiva === aba.id
              ? '0 2px 8px rgba(45, 80, 22, 0.3)'
              : 'none'
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>{aba.icon}</span>
          <span>{aba.label}</span>
        </button>
      ))}
    </nav>
  );
}
