import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { Toaster } from './Toaster';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/*
      `basename` = valeur de --base passée à `vite build` (import.meta.env.BASE_URL,
      toujours "/" par défaut — aucun changement pour un déploiement classique à la
      racine de son propre domaine). Sans ça, <Routes> ne matche rien quand l'app
      est servie sous un sous-chemin (ex. panel UHQ Panel OS qui embarque et
      proxifie cet addon sous /addon-proxy/wallet/) : la route "/admin" ne matche
      jamais le pathname réel "/addon-proxy/wallet/admin" — page blanche silencieuse.
    */}
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
      <Toaster />
    </BrowserRouter>
  </React.StrictMode>,
);
