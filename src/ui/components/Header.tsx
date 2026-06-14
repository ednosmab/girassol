export function Header() {
  return (
    <header style={{
      background: 'linear-gradient(135deg, #2d5016 0%, #4a7c24 100%)',
      color: '#fff',
      padding: '1rem 1.5rem',
      textAlign: 'center',
      boxShadow: '0 4px 12px rgba(45, 80, 22, 0.3)'
    }}>
      <h1 style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: '1.8rem',
        fontWeight: 700,
        margin: 0,
        letterSpacing: '0.02em'
      }}>
        🌻 Meu Girassol
      </h1>
      <p style={{
        fontFamily: "'Caveat', cursive",
        fontSize: '1rem',
        margin: '0.25rem 0 0',
        opacity: 0.9
      }}>
        Diário Interativo de Cuidados
      </p>
    </header>
  );
}
