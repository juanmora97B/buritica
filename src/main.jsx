import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { supabaseConfigError } from "./lib/supabase";
import "./index.css";

// Service Worker deshabilitado para Neocities (CSP restrictions)
// En hosting moderno (Vercel/Netlify) se puede habilitar

if (supabaseConfigError) {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-6 rounded-xl shadow w-full max-w-xl">
        <h1 className="text-xl font-bold mb-2">Configuración pendiente</h1>
        <p className="text-red-600 text-sm mb-2">{supabaseConfigError}</p>
        <p className="text-gray-600 text-sm">
          Luego de agregar variables en Vercel, ejecuta un redeploy en Production.
        </p>
      </div>
    </div>
  );
} else {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <ErrorBoundary>
      <BrowserRouter>
        <App />
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

