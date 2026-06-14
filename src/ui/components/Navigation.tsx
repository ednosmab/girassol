import { useState } from 'react';

interface NavigationProps {
  abaAtiva: string;
  onTrocarAba: (aba: string) => void;
}

const abas = [
  { id: 'diario', label: 'Meu Diário', icone: '🌻' },
  { id: 'cuidados', label: 'Guia de Cuidados', icone: '💧' },
  { id: 'origem', label: 'Origem & História', icone: '🌍' },
  { id: 'curiosidades', label: 'Mistérios da Flor', icone: '✨' }
];

export function Navigation({ abaAtiva, onTrocarAba }: NavigationProps) {
  const [menuAberto, setMenuAberto] = useState(false);

  const handleTrocar = (id: string) => {
    onTrocarAba(id);
    setMenuAberto(false);
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  return (
    <>
      <button
        onClick={() => setMenuAberto(!menuAberto)}
        aria-label="Abrir Menu"
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 100,
          background: '#F2B705',
          border: 'none',
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          cursor: 'pointer',
          boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '5px',
          transition: 'transform 0.3s'
        }}
      >
        <span style={{
          width: '25px',
          height: '3px',
          background: '#3C2A21',
          borderRadius: '2px',
          transition: '0.3s',
          transform: menuAberto ? 'rotate(45deg) translate(5px, 6px)' : 'none'
        }} />
        <span style={{
          width: '25px',
          height: '3px',
          background: '#3C2A21',
          borderRadius: '2px',
          transition: '0.3s',
          opacity: menuAberto ? 0 : 1
        }} />
        <span style={{
          width: '25px',
          height: '3px',
          background: '#3C2A21',
          borderRadius: '2px',
          transition: '0.3s',
          transform: menuAberto ? 'rotate(-45deg) translate(5px, -6px)' : 'none'
        }} />
      </button>

      {menuAberto && (
        <div
          onClick={() => setMenuAberto(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
            zIndex: 98
          }}
        />
      )}

      <nav style={{
        position: 'fixed',
        top: 0,
        right: menuAberto ? '0' : '-280px',
        width: '280px',
        height: '100vh',
        background: '#3C2A21',
        zIndex: 99,
        paddingTop: '100px',
        transition: 'right 0.4s cubic-bezier(0.1, 1, 0.1, 1)',
        boxShadow: '-5px 0 20px rgba(0,0,0,0.3)'
      }}>
        {abas.map((aba) => (
          <a
            key={aba.id}
            href="#"
            onClick={(e) => { e.preventDefault(); handleTrocar(aba.id); }}
            style={{
              display: 'block',
              color: abaAtiva === aba.id ? '#F2B705' : '#FFFDF9',
              padding: '18px 30px',
              textDecoration: 'none',
              fontSize: '1.2rem',
              fontWeight: 600,
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              transition: '0.3s',
              background: abaAtiva === aba.id ? 'rgba(242, 183, 5, 0.1)' : 'transparent'
            }}
          >
            {aba.icone} {aba.label}
          </a>
        ))}
      </nav>
    </>
  );
}
