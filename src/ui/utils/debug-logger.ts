export type LogLevel = 'info' | 'warn' | 'error' | 'sw';

export interface DebugLogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
}

type Listener = (entry: DebugLogEntry) => void;

let _id = 0;
const _listeners: Listener[] = [];
const _history: DebugLogEntry[] = [];
const MAX_HISTORY = 200;

export function addDebugLog(level: LogLevel, source: string, message: string): DebugLogEntry {
  const entry: DebugLogEntry = {
    id: _id++,
    timestamp: new Date().toLocaleTimeString('pt-BR'),
    level,
    source,
    message
  };
  _history.push(entry);
  if (_history.length > MAX_HISTORY) _history.shift();
  _listeners.forEach(fn => fn(entry));
  return entry;
}

export function addDebugListener(fn: Listener): () => void {
  _listeners.push(fn);
  return () => { _listeners.splice(_listeners.indexOf(fn), 1); };
}

export function getDebugHistory(): DebugLogEntry[] {
  return [..._history];
}

export function clearDebugHistory(): void {
  _history.length = 0;
}

let _intercepted = false;

export function interceptConsole(): void {
  if (_intercepted) return;
  _intercepted = true;

  const origLog = console.log.bind(console);
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);

  console.log = (...args: unknown[]) => {
    origLog(...args);
    const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    if (msg.startsWith('[') || msg.includes('NOTIF') || msg.includes('CHECK') || msg.includes('PUSH')) {
      addDebugLog('info', msg.match(/^\[([^\]]+)\]/)?.[1] || 'LOG', msg.replace(/^\[[^\]]+\]\s*/, ''));
    }
  };

  console.warn = (...args: unknown[]) => {
    origWarn(...args);
    const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    addDebugLog('warn', msg.match(/^\[([^\]]+)\]/)?.[1] || 'WARN', msg.replace(/^\[[^\]]+\]\s*/, ''));
  };

  console.error = (...args: unknown[]) => {
    origError(...args);
    const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    addDebugLog('error', msg.match(/^\[([^\]]+)\]/)?.[1] || 'ERROR', msg.replace(/^\[[^\]]+\]\s*/, ''));
  };
}

export function listenSWMessages(): void {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'SW_LOG') {
      addDebugLog('sw', event.data.source || 'SW', event.data.message || JSON.stringify(event.data));
    }
  });
}
