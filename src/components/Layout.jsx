import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gradient-to-b from-green-700 to-green-800 text-white p-5 border-r border-green-900/30">
        <div className="mb-8 rounded-xl bg-green-600/40 p-3 border border-green-500/40">
          <h1 className="text-xl font-bold flex items-center gap-3">
            <span className="text-2xl">🐷</span>
            <span>Familia Buritica</span>
          </h1>
          <p className="text-xs text-green-100 mt-1">Control porcino y ventas</p>
        </div>

        <nav className="flex flex-col gap-2">
          {menuItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={navClass} end={item.to === "/"}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}

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
      <main className="flex-1 p-8 bg-gray-100">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
