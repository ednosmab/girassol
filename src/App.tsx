import { useState, useEffect } from 'react';
import { Header } from './ui/components/Header';
import { Navigation } from './ui/components/Navigation';
import { InstallPrompt } from './ui/components/InstallPrompt';
import { TestarPush } from './ui/components/TestarPush';
import { DiarioView } from './ui/views/DiarioView';
import { CuidadosView } from './ui/views/CuidadosView';
import { OrigemView } from './ui/views/OrigemView';
import { CuriosidadesView } from './ui/views/CuriosidadesView';
import { buscarHistorico } from './core/use-cases/buscar-historico';

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
      case 'origem':
        return <OrigemView />;
      case 'curiosidades':
        return <CuriosidadesView />;
      default:
        return <DiarioView />;
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      background: '#FFFDF9',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      color: '#3C2A21',
      overflowX: 'hidden',
      margin: 0,
      padding: 0
    }}>
      <Header />
      <Navigation abaAtiva={abaAtiva} onTrocarAba={setAbaAtiva} />
      <main style={{ paddingBottom: '60px' }}>
        {renderizarAba()}
      </main>
      <InstallPrompt />
      <TestarPush />
      <footer style={{
        textAlign: 'center',
        padding: '40px 20px',
        fontSize: '0.9rem',
        color: '#A0A0A0'
      }}>
        <p>Criado com amor para a melhor sogra do mundo.</p>
      </footer>
    </div>
  );
}
