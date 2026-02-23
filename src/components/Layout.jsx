import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { canManageUsersByRole } from "../lib/permissions";

const menuItems = [
  { to: "/", label: "Dashboard", icon: "📊" },
  { to: "/cerdos", label: "Cerdos", icon: "🐖" },
  { to: "/ventas", label: "Ventas", icon: "🧾" },
  { to: "/clientes", label: "Clientes", icon: "👥" },
  { to: "/fiados", label: "Fiados", icon: "💳" },
  { to: "/gastos", label: "Gastos", icon: "💸" },
];

const navClass = ({ isActive }) =>
  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
    isActive
      ? "bg-white text-green-800 shadow"
      : "text-green-50 hover:bg-green-600 hover:text-white"
  }`;

function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile } = useCurrentUser();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const handleNavigate = () => {
    setMenuAbierto(false);
  };

  useEffect(() => {
    setMenuAbierto(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="md:hidden sticky top-0 z-40 bg-green-700 text-white px-4 py-3 flex items-center justify-between shadow">
        <button
          type="button"
          onClick={() => setMenuAbierto(true)}
          className="text-xl"
          aria-label="Abrir menú"
        >
          ☰
        </button>
        <h1 className="font-bold">Familia Buritica</h1>
        <button
          onClick={handleLogout}
          className="text-sm bg-green-800 px-2 py-1 rounded"
        >
          Salir
        </button>
      </header>

      <div className="min-h-[calc(100vh-56px)] md:min-h-screen md:flex">
      {menuAbierto && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMenuAbierto(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:static z-50 top-0 left-0 h-full md:h-auto w-64 bg-gradient-to-b from-green-700 to-green-800 text-white p-5 border-r border-green-900/30 transform transition-transform duration-200 ${menuAbierto ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>
        <div className="md:hidden flex justify-end mb-2">
          <button
            type="button"
            onClick={() => setMenuAbierto(false)}
            className="text-white bg-green-800/80 px-2 py-1 rounded"
            aria-label="Cerrar menú"
          >
            ✕
          </button>
        </div>

        <div className="mb-8 rounded-xl bg-green-600/40 p-3 border border-green-500/40">
          <h1 className="text-xl font-bold flex items-center gap-3">
            <span className="text-2xl">🐷</span>
            <span>Familia Buritica</span>
          </h1>
          <p className="text-xs text-green-100 mt-1">Control porcino y ventas</p>
          <div className="mt-3 bg-green-700/40 rounded-lg p-2 border border-green-500/30">
            <p className="text-[11px] text-green-100">
              Usuario: <span className="font-semibold">{userProfile?.nombre || userProfile?.email || "-"}</span>
            </p>
            <p className="text-[11px] text-green-100">
              Rol actual: <span className="font-semibold uppercase">{userProfile?.rol || "-"}</span>
            </p>
            <p className="text-[11px] text-green-100">
              Estado: <span className="font-semibold uppercase">{userProfile?.estado || "-"}</span>
            </p>
          </div>
        </div>

        <nav className="flex flex-col gap-2">
          {menuItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={navClass} end={item.to === "/"} onClick={handleNavigate}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}

          {canManageUsersByRole(userProfile?.rol) && (
            <>
              <NavLink to="/usuarios" className={navClass} onClick={handleNavigate}>
                <span>🛡️</span>
                <span>Usuarios</span>
              </NavLink>
              <NavLink to="/auditoria" className={navClass} onClick={handleNavigate}>
                <span>📚</span>
                <span>Auditoría</span>
              </NavLink>
            </>
          )}

          <div className="my-3 border-t border-green-600" />

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-100 hover:bg-red-500/20 hover:text-white transition-all text-left"
          >
            <span>🚪</span>
            <span>Cerrar sesión</span>
          </button>
        </nav>

        <div className="mt-6 text-[11px] text-green-200/80 px-1">
          Menú rápido del negocio
        </div>
      </aside>

      {/* Contenido */}
      <main className="flex-1 p-4 md:p-8 bg-gray-100 md:ml-0">
        <Outlet />
      </main>
      </div>
    </div>
  );
}

export default Layout;
