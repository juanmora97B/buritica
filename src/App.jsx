import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Cerdos = lazy(() => import("./pages/Cerdos"));
const Ventas = lazy(() => import("./pages/Ventas"));
const NuevaVenta = lazy(() => import("./pages/NuevaVenta"));
const Clientes = lazy(() => import("./pages/Clientes"));
const Fiados = lazy(() => import("./pages/Fiados"));
const Gastos = lazy(() => import("./pages/Gastos"));
const Usuarios = lazy(() => import("./pages/Usuarios"));
const Auditoria = lazy(() => import("./pages/Auditoria"));
const Login = lazy(() => import("./pages/Login"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center text-gray-600">
    Cargando...
  </div>
);

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/cerdos" element={<Cerdos />} />
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/ventas/nueva" element={<NuevaVenta />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/fiados" element={<Fiados />} />
          <Route path="/gastos" element={<Gastos />} />
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="/auditoria" element={<Auditoria />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
