import { useState, useEffect } from 'react';

const STORAGE_KEY = 'girassol_install_dismissed';

let deferredPrompt: any = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (!localStorage.getItem(STORAGE_KEY)) {
    window.dispatchEvent(new CustomEvent('pwa-pode-instalar'));
  }
});

export async function acionarInstalacaoPWA(): Promise<string> {
  if (!deferredPrompt) return 'indisponivel';

  deferredPrompt.prompt();

  const { outcome } = await deferredPrompt.userChoice;
  localStorage.setItem(STORAGE_KEY, 'true');
  deferredPrompt = null;
  return outcome;
}

export function InstallPrompt() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;

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
      gap: '12px'
    }}>
      <span style={{ fontSize: '2rem' }}>📲</span>
      <div style={{ flex: 1 }}>
        <p style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: '0.9rem',
          fontWeight: 700,
          color: '#F2B705',
          margin: 0
        }}>
          Instalar Jardim Secreto
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
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, 'true');
          setVisivel(false);
        }}
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
