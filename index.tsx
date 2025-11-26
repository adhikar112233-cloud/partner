
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App';
import SuccessPage from './components/SuccessPage';
import PaymentPage from './components/PaymentPage';
import MockDigiLockerPage from './components/MockDigiLockerPage';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Define routes
const routes = [
  { path: "/", component: App },
  { path: "/success", component: SuccessPage },
  { path: "/payment", component: PaymentPage },
  { path: "/mock-digilocker", component: MockDigiLockerPage }
];

const root = createRoot(rootElement);

// Simple client-side router logic
const currentPath = window.location.pathname.replace(/\/$/, "").replace(".html", "") || "/";
const RouteComponent = routes.find(r => r.path === currentPath)?.component || App;

root.render(
  <React.StrictMode>
    <RouteComponent />
  </React.StrictMode>
);
