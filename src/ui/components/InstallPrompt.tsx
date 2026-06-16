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
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 200,
      padding: '16px',
      background: 'linear-gradient(135deg, #3C2A21 0%, #5a3d2a 100%)',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      animation: 'slideUp 0.4s ease-out'
    }}>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
      <span style={{ fontSize: '2rem' }}>📲</span>
      <div style={{ flex: 1 }}>
        <p style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: '0.9rem',
          fontWeight: 700,
          color: '#F2B705',
          margin: 0
        }}>
          Instalar
        </p>
        <p style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: '0.75rem',
          color: '#ccc',
          margin: '2px 0 0'
        }}>
          Acesso rápido na tela inicial
        </p>
      </div>
      <button
        onClick={async () => {
          const resultado = await acionarInstalacaoPWA();
          if (resultado === 'accepted') setVisivel(false);
        }}
        style={{
          border: 'none',
          borderRadius: '40px 10px 40px 10px',
          background: '#F2B705',
          color: '#3C2A21',
          padding: '10px 18px',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 700,
          fontSize: '0.85rem',
          cursor: 'pointer',
          whiteSpace: 'nowrap'
        }}
      >
        Instalar
      </button>
      <button
        onClick={() => setVisivel(false)}
        aria-label="Fechar"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#999',
          fontSize: '1.2rem',
          cursor: 'pointer',
          padding: '0 4px'
        }}
      >
        ✕
      </button>
    </div>
  );
}
