import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';

const updateSW = registerSW({
  immediate: true,
});

let lastFocusCheck = 0;

window.addEventListener('focus', () => {
  const now = Date.now();
  if (now - lastFocusCheck < 60_000) return;
  lastFocusCheck = now;
  updateSW?.();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
