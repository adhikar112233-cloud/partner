import React from 'react';
import { createRoot } from 'react-dom/client';
// Fix: Reverted to a default import to resolve the module error.
import App from './components/App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);