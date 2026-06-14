import { useState, useEffect } from 'react';

let deferredPrompt: any = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  window.dispatchEvent(new CustomEvent('pwa-pode-instalar'));
});

export async function acionarInstalacaoPWA(): Promise<string> {
  if (!deferredPrompt) return 'indisponivel';

  deferredPrompt.prompt();

  const { outcome } = await deferredPrompt.userChoice;
  console.log(`Usuário respondeu à instalação: ${outcome}`);

  deferredPrompt = null;
  return outcome;
}

export function InstallPrompt() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const handler = () => setVisivel(true);
    window.addEventListener('pwa-pode-instalar', handler);
    return () => window.removeEventListener('pwa-pode-instalar', handler);
  }, []);

  if (!visivel) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #fefdf5 0%, #f0edd4 100%)',
      borderRadius: '16px',
      padding: '1rem 1.25rem',
      margin: '0 1rem 0.75rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      border: '2px solid #4a7c2430',
      boxShadow: '0 2px 8px rgba(45, 80, 22, 0.1)'
    }}>
      <span style={{ fontSize: '1.8rem' }}>📲</span>
      <div style={{ flex: 1 }}>
        <p style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: '0.85rem',
          fontWeight: 600,
          color: '#2d5016',
          margin: 0
        }}>
          Instalar Meu Girassol
        </p>
        <p style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: '0.75rem',
          color: '#666',
          margin: '0.125rem 0 0'
        }}>
          Adicione à tela inicial para acesso rápido
        </p>
      </div>
      <button
        onClick={async () => {
          const resultado = await acionarInstalacaoPWA();
          if (resultado === 'accepted') setVisivel(false);
        }}
        aria-label="Instalar aplicativo"
        style={{
          border: 'none',
          borderRadius: '50px',
          background: 'linear-gradient(135deg, #2d5016, #4a7c24)',
          color: '#fff',
          padding: '0.5rem 1rem',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 600,
          fontSize: '0.8rem',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(45, 80, 22, 0.3)',
          whiteSpace: 'nowrap'
        }}
      >
        Instalar
      </button>
    </div>
  );
}
