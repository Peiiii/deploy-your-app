import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import './i18n/config';
import App from './app';
import { cleanupDevServiceWorker } from './utils/dev-sw-cleanup';

void cleanupDevServiceWorker();
if (import.meta.env.DEV) {
  console.info('[deploy-your-app-frontend] dev build loaded');
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
