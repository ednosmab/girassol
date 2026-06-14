export function OrigemView() {
  return (
    <div style={{ padding: '0 20px', marginTop: '-40px', position: 'relative', zIndex: 10 }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '30px',
        padding: '40px 30px',
        boxShadow: '0 15px 40px rgba(60, 42, 33, 0.04)',
        borderLeft: '8px solid #40513B',
        marginBottom: '30px'
      }}>
        <h2 style={{
          fontFamily: "'Caveat', cursive",
          fontSize: '2.5rem',
          fontWeight: 600,
          color: '#40513B',
          marginTop: 0,
          marginBottom: '15px'
        }}>
          🌍 De Onde Vem Essa Força?
        </h2>
        <p style={{
          fontSize: '1.05rem',
          lineHeight: 1.7,
          color: '#4A4A4A'
        }}>
          Embora pareça uma flor tipicamente tropical, os girassóis são nativos das Américas do Norte e Central, domesticados por povos indígenas há mais de 3.000 anos. Eles usavam as sementes não apenas como base alimentícia, mas também para extrair pigmentos roxos e amarelos para tingir tecidos e pintar o corpo em rituais sagrados.
        </p>
        <div style={{
          background: '#F2B705',
          width: '80px',
          height: '40px',
          borderRadius: '0 100px',
          margin: '20px auto',
          opacity: 0.7
        }} />
        <p style={{
          fontSize: '1.05rem',
          lineHeight: 1.7,
          color: '#4A4A4A'
        }}>
          Mais tarde, no século XVI, navegadores espanhóis se apaixonaram pelo porte gigante da flor e levaram as sementes para a Europa, onde ela deixou de ser um alimento e se tornou o maior símbolo de elegância nos jardins reais europeus.
        </p>
      </div>
    </div>
  );
}
