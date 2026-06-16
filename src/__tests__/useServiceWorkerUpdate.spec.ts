import { renderHook, act } from '@testing-library/react';
import { jest } from '@jest/globals';
import { useServiceWorkerUpdate } from '../core/hooks/useServiceWorkerUpdate';

const mockUpdate = jest.fn();
const mockPostMessage = jest.fn();

const mockReg: any = {
  update: mockUpdate,
  waiting: null as ServiceWorker | null,
  installing: null,
  active: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockReg.waiting = null;
  (global as any).navigator.serviceWorker = {
    ready: Promise.resolve(mockReg),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    controller: null,
  };
  Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useServiceWorkerUpdate', () => {
  it('deve iniciar em status idle', () => {
    const { result } = renderHook(() => useServiceWorkerUpdate());
    expect(result.current.status).toBe('idle');
  });

  it('deve chamar update() após delay inicial de 3s', async () => {
    renderHook(() => useServiceWorkerUpdate());
    expect(mockUpdate).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(3_000);
    });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('deve chamar update() periodicamente a cada 30min', async () => {
    renderHook(() => useServiceWorkerUpdate());
    await act(async () => {
      jest.advanceTimersByTime(3_000);
    });
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(30 * 60 * 1000);
    });
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it('deve throttlar checks em visibilitychange → visible', async () => {
    renderHook(() => useServiceWorkerUpdate());
    await act(async () => {
      jest.advanceTimersByTime(3_000);
    });
    const callsAfterInit = mockUpdate.mock.calls.length;

    // Primeiro visibilitychange → visible: lastVisibleCheck=0, então agora >= 60s → check
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Segundo visibilitychange → visible imediatamente: throttle ativo (< 60s)
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Apenas 1 check adicional (o primeiro visibilitychange; o segundo é throttlado)
    expect(mockUpdate.mock.calls.length).toBe(callsAfterInit + 1);
  });

  it('deve permitir check em visibilitychange → visible após 60s', async () => {
    renderHook(() => useServiceWorkerUpdate());
    await act(async () => {
      jest.advanceTimersByTime(3_000);
    });
    const callsAfterInit = mockUpdate.mock.calls.length;

    // Primeiro visibilitychange → visible: check (lastVisibleCheck=0)
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Avança 60s para resetar o throttle
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });

    // Segundo visibilitychange → visible: check novamente (throttle expirou)
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // 2 checks adicionais (um por cada visibilitychange válido)
    expect(mockUpdate.mock.calls.length).toBe(callsAfterInit + 2);
  });

  it('deve postar SKIP_WAITING quando vai pra hidden e há worker waiting', async () => {
    const waiting = { postMessage: mockPostMessage } as unknown as ServiceWorker;
    mockReg.waiting = waiting;

    renderHook(() => useServiceWorkerUpdate());

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true, configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('não deve chamar update() se serviceWorker não existe', async () => {
    const original = (global as any).navigator.serviceWorker;
    delete (global as any).navigator.serviceWorker;
    try {
      renderHook(() => useServiceWorkerUpdate());
      await act(async () => {
        jest.advanceTimersByTime(5_000);
      });
      expect(mockUpdate).not.toHaveBeenCalled();
    } finally {
      (global as any).navigator.serviceWorker = original;
    }
  });
});
