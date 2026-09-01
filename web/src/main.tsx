import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
      <App />
    </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);

window.addEventListener("error", function (e) {
  fetch("http://localhost:4100/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error: e.message, filename: e.filename, lineno: e.lineno })
  }).catch(() => {});
});
