export function CuriosidadesView() {
  return (
    <div style={{ padding: '0 20px', marginTop: '-40px', position: 'relative', zIndex: 10 }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '30px',
        padding: '40px 30px',
        boxShadow: '0 15px 40px rgba(60, 42, 33, 0.04)',
        borderLeft: '8px solid #F2B705',
        marginBottom: '30px'
      }}>
        <h2 style={{
          fontFamily: "'Caveat', cursive",
          fontSize: '2.5rem',
          fontWeight: 600,
          color: '#3C2A21',
          marginTop: 0,
          marginBottom: '15px'
        }}>
          🌻 O Bailado do Heliotropismo
        </h2>
        <p style={{
          fontSize: '1.05rem',
          lineHeight: 1.7,
          color: '#4A4A4A'
        }}>
          A característica mais mágica do girassol é a sua capacidade de se mover com base na posição do sol. Esse fenômeno acontece por conta de um hormônio de crescimento vegetal chamado <em>auxina</em>, que se acumula no lado sombreado do caule, fazendo com que esse lado cresça mais rápido e curve a flor gentilmente em direção à luz.
        </p>
      </div>

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
          ✨ Você Sabia? Ela não é uma flor só!
        </h2>
        <p style={{
          fontSize: '1.05rem',
          lineHeight: 1.7,
          color: '#4A4A4A'
        }}>
          O que chamamos de "flor do girassol" é, na verdade, uma gigantesca inflorescência. Aquela cabeça escura no centro é composta por milhares de minúsculas flores individuais (chamadas de flores do disco), dispostas em padrões matemáticos perfeitos que seguem a famosa Sequência de Fibonacci. A natureza é perfeitamente cirúrgica!
        </p>
      </div>
    </div>
  );
}
