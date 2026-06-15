import { useState } from 'react';
import { Header } from './ui/components/Header';
import { Navigation } from './ui/components/Navigation';
import { InstallPrompt } from './ui/components/InstallPrompt';
import { TestarPush } from './ui/components/TestarPush';
import { SyncStatus } from './ui/components/SyncStatus';
import { DiarioView } from './ui/views/DiarioView';
import { CuidadosView } from './ui/views/CuidadosView';
import { OrigemView } from './ui/views/OrigemView';
import { CuriosidadesView } from './ui/views/CuriosidadesView';
import { SyncProvider } from './core/contexts/SyncContext';

export default function App() {
  const [abaAtiva, setAbaAtiva] = useState('diario');

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
