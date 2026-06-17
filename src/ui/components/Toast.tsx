import { useState, useEffect } from 'react';

interface ToastProps {
  mensagem: string;
  icone: string;
  cor: string;
  duracao?: number;
  onFim?: () => void;
}

export function Toast({ mensagem, icone, cor, duracao = 3500, onFim }: ToastProps) {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisivel(true));
    const timer = setTimeout(() => {
      setVisivel(false);
      setTimeout(() => onFim?.(), 400);
    }, duracao);
    return () => clearTimeout(timer);
  }, [duracao, onFim]);

  return (
    <>
      <style>{`
        @keyframes toastSlideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes toastFadeOut {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(20px); opacity: 0; }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '0',
        right: '0',
        display: 'flex',
        justifyContent: 'center',
        zIndex: 11000,
        animation: visivel
          ? 'toastSlideUp 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards'
          : 'toastFadeOut 0.35s ease-in forwards',
        pointerEvents: 'none',
        transform: 'translateY(-50%)'
      }}>
        <div style={{
          position: 'relative',
          background: '#FFFFFF',
          borderRadius: '16px',
          padding: '14px 22px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: `0 8px 30px ${cor}33, 0 2px 8px rgba(0,0,0,0.08)`,
          border: `2px solid ${cor}22`,
          maxWidth: '90vw',
          whiteSpace: 'nowrap',
          overflow: 'hidden'
        }}>
          <span style={{ fontSize: '1.4rem' }}>{icone}</span>
          <span style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '0.9rem',
            fontWeight: 600,
            color: '#3C2A21',
            letterSpacing: '-0.01em'
          }}>
            {mensagem}
          </span>
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: '16px',
            right: '16px',
            height: '3px',
            borderRadius: '3px',
            background: `${cor}30`,
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              background: cor,
              borderRadius: '3px',
              animation: `toastProgress ${duracao}ms linear forwards`
            }} />
          </div>
        </div>
      </div>
      <style>{`
        @keyframes toastProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </>
  );
}
