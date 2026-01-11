import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import axios from 'axios';

// Configuración Global de API para Producción (Fix HTML Response Error)
const IS_PROD = import.meta.env.PROD || window.location.hostname !== 'localhost';
axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL || (IS_PROD
  ? 'https://criptodamusfinal.onrender.com'
  : 'http://localhost:3001');

console.log(`🌐 API Base URL: ${axios.defaults.baseURL}`);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);