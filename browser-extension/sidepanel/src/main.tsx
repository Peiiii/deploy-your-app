import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

import { sidepanelController } from './sidepanel-controller';

// Initialize Controller (listeners, protocols)
sidepanelController.start();

ReactDOM.createRoot(document.getElementById('root')!).render(

  <React.StrictMode>
    <App />
  </React.StrictMode>
);
