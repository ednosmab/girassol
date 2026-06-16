export function Header() {
  return (
    <header style={{
      background: 'linear-gradient(135deg, #F2B705 0%, #D98E04 100%)',
      color: '#3C2A21',
      padding: '80px 20px 100px 20px',
      textAlign: 'center',
      position: 'relative',
      borderBottomLeftRadius: '50% 8%',
      borderBottomRightRadius: '50% 8%',
      boxShadow: '0 10px 30px rgba(217, 142, 4, 0.15)'
    }}>
      <h1 style={{
        fontFamily: "'Caveat', cursive",
        fontSize: 'clamp(3rem, 10vw, 4rem)',
        fontWeight: 600,
        margin: 0,
        lineHeight: 1
      }}>
        Jardim Secreto
      </h1>
      <p style={{
        margin: '10px 0 0 0',
        fontSize: '1.1rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '2px',
        opacity: 0.8
      }}>
        O Guia Vivente do Seu Girassol
      </p>
    </header>
  );
}
