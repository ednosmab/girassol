import { useState, useEffect } from 'react';
import { Header } from './ui/components/Header';
import { Navigation } from './ui/components/Navigation';
import { DiarioView } from './ui/views/DiarioView';
import { CuidadosView } from './ui/views/CuidadosView';
import { InstallPrompt } from './ui/components/InstallPrompt';
import { buscarHistorico } from './core/use-cases/buscar-historico';

function AgendaViewPlaceholder() {
  return (
    <div style={{ padding: '1rem', textAlign: 'center' }}>
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '2rem',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
      }}>
        <span style={{ fontSize: '3rem', display: 'block' }}>🔔</span>
        <h2 style={{
          fontFamily: "'Playfair Display', serif",
          color: '#2d5016',
          margin: '1rem 0 0.5rem'
        }}>
          Notificações
        </h2>
        <p style={{
          fontFamily: "'Caveat', cursive",
          fontSize: '1.1rem',
          color: '#666'
        }}>
          Use a aba Diário para registrar e notificar seus cuidados
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [abaAtiva, setAbaAtiva] = useState('diario');

  useEffect(() => {
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible') {
        await buscarHistorico();

        if ('serviceWorker' in navigator) {
          try {
            const registration = await navigator.serviceWorker.ready;
            await registration.update();
          } catch (error) {
            console.warn('Service Worker update failed:', error);
          }
        }
      }
    });

    return () => {
      document.removeEventListener('visibilitychange', () => {});
    };
  }, []);

  const renderizarAba = () => {
    switch (abaAtiva) {
      case 'diario':
        return <DiarioView />;
      case 'cuidados':
        return <CuidadosView />;
      case 'agenda':
        return <AgendaViewPlaceholder />;
      default:
        return <DiarioView />;
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fefdf5',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      maxWidth: '480px',
      margin: '0 auto',
      boxShadow: '0 0 40px rgba(0,0,0,0.08)'
    }}>
      <Header />
      <InstallPrompt />
      <Navigation abaAtiva={abaAtiva} onTrocarAba={setAbaAtiva} />
      <main style={{ paddingBottom: '2rem' }}>
        {renderizarAba()}
      </main>
    </div>
  );
}
