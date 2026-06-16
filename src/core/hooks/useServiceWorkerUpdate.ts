import { useEffect, useRef, useState, useCallback } from 'react';

export type SWUpdateStatus = 'idle' | 'checking' | 'available' | 'activating' | 'activated';

interface UpdateState {
  status: SWUpdateStatus;
}

const INITIAL_CHECK_DELAY_MS = 3_000;
const PERIODIC_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const VISIBLE_THROTTLE_MS = 60_000;

export function useServiceWorkerUpdate(): UpdateState {
  const [state, setState] = useState<UpdateState>({ status: 'idle' });
  const refreshingRef = useRef(false);
  const checkInFlightRef = useRef(false);

  const checkForUpdate = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return;
    if (checkInFlightRef.current) return;
    checkInFlightRef.current = true;
    setState((s) => ({ ...s, status: 'checking' }));

    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.update();
      if (reg.waiting) {
        setState((s) => ({ ...s, status: 'available' }));
      } else {
        setState((s) => ({ ...s, status: 'idle' }));
      }
    } catch (err) {
      console.warn('[SW] update() falhou:', err);
      setState((s) => ({ ...s, status: 'idle' }));
    } finally {
      checkInFlightRef.current = false;
    }
  }, []);

  const activateWaiting = useCallback((waiting: ServiceWorker | null) => {
    if (!waiting) return;
    waiting.postMessage({ type: 'SKIP_WAITING' });
    setState((s) => ({ ...s, status: 'activating' }));
  }, []);

  // Detecta novo controller e recarrega uma vez
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onControllerChange = () => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, []);

  // Loop de verificação
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const initial = setTimeout(checkForUpdate, INITIAL_CHECK_DELAY_MS);
    const interval = setInterval(checkForUpdate, PERIODIC_CHECK_INTERVAL_MS);

    let lastVisibleCheck = 0;
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastVisibleCheck < VISIBLE_THROTTLE_MS) return;
        lastVisibleCheck = now;
        checkForUpdate();
      } else {
        // Hidden: se há waiting worker, ativa agora
        navigator.serviceWorker.ready.then((reg) => {
          if (reg.waiting) {
            activateWaiting(reg.waiting);
            setState((s) => ({ ...s, status: 'activated' }));
          }
        });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [checkForUpdate, activateWaiting]);

  return state;
}
