import { useState, useEffect } from 'react';
import { Header } from './ui/components/Header';
import { Navigation } from './ui/components/Navigation';
import { InstallPrompt } from './ui/components/InstallPrompt';
import { TestarPush } from './ui/components/TestarPush';
import { SyncStatus } from './ui/components/SyncStatus';
import { DiarioView } from './ui/views/DiarioView';
import { CuidadosView } from './ui/views/CuidadosView';
import { OrigemView } from './ui/views/OrigemView';
import { CuriosidadesView } from './ui/views/CuriosidadesView';
import { buscarHistorico } from './core/use-cases/buscar-historico';
import { SyncProvider } from './core/contexts/SyncContext';

export default function App() {
  const [abaAtiva, setAbaAtiva] = useState('diario');

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let swAtualController: ServiceWorker | null = null;

    navigator.serviceWorker.ready.then((reg) => {
      swAtualController = reg.active;
      console.log('[Girassol] SW ativo:', reg.active?.scriptURL || 'nenhum');
    });

    const handleVisibility = async () => {
      if (document.visibilityState === 'hidden') {
        console.log('[Girassol] APP_HIDDEN');

        try {
          const registration = await navigator.serviceWorker.ready;
          console.log('[Girassol] CHECKING_FOR_UPDATE');

          const newWorker = await registration.update();

          if (newWorker) {
            console.log('[Girassol] UPDATE_FOUND:', newWorker.scope);
          } else {
            console.log('[Girassol] NO_UPDATE');
          }

          if (newWorker && newWorker.waiting) {
            console.log('[Girassol] SKIP_WAITING_SENT');
            newWorker.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        } catch (error) {
          console.warn('[Girassol] UPDATE_FAILED:', error);
        }
      }

      if (document.visibilityState === 'visible') {
        console.log('[Girassol] APP_VISIBLE');
        await buscarHistorico();

        const controllerAtual = navigator.serviceWorker.controller;
        const mudou = controllerAtual && controllerAtual !== swAtualController;

        console.log('[Girassol] CONTROLLER_CHANGED:', mudou);

        if (mudou) {
          console.log('[Girassol] APP_RELOADED');
          window.location.reload();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
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
    <SyncProvider>
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
        <SyncStatus />
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
    </SyncProvider>
  );
}
