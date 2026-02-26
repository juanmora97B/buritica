import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { Navigate } from "react-router-dom"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { canManageUsersByRole } from "../lib/permissions"
import { createUserFromAdmin, deleteUserProfile, listUsers, updateUserRole, updateUserStatus } from "../services/authService"

const ROLES = ["admin", "operador", "vendedor"]
const ESTADOS = ["activo", "inactivo"]

export default function Usuarios() {
  const { user, userProfile, loading } = useCurrentUser()
  const [usuarios, setUsuarios] = useState([])
  const [savingId, setSavingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [creating, setCreating] = useState(false)

  const [nuevoNombre, setNuevoNombre] = useState("")
  const [nuevoEmail, setNuevoEmail] = useState("")
  const [nuevoPassword, setNuevoPassword] = useState("")
  const [nuevoRol, setNuevoRol] = useState("vendedor")
  const [nuevoEstado, setNuevoEstado] = useState("activo")

  const isAdmin = canManageUsersByRole(userProfile?.rol)

  const cargarUsuarios = async () => {
    const data = await listUsers()
    if (!data) {
      toast.error("No se pudieron cargar los usuarios")
      return
    }
    setUsuarios(data)
  }

  useEffect(() => {
    if (isAdmin) {
      cargarUsuarios()
    }
  }, [isAdmin])

  const cambiarCampo = (id, campo, valor) => {
    setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, [campo]: valor } : u)))
  }

  const guardarFila = async (usuario) => {
    setSavingId(usuario.id)

    const resultadoRol = await updateUserRole(usuario.id, usuario.rol)
    if (!resultadoRol) {
      setSavingId(null)
      toast.error("No se pudo actualizar el rol")
      return
    }

    const resultadoEstado = await updateUserStatus(usuario.id, usuario.estado)
    if (!resultadoEstado) {
      setSavingId(null)
      toast.error("No se pudo actualizar el estado")
      return
    }

    toast.success("Usuario actualizado")
    setSavingId(null)
    cargarUsuarios()
  }

  const crearUsuario = async () => {
    if (!nuevoNombre || !nuevoEmail || !nuevoPassword) {
      return toast.error("Nombre, email y contraseña son obligatorios")
    }

    if (nuevoPassword.length < 6) {
      return toast.error("La contraseña debe tener al menos 6 caracteres")
    }

    setCreating(true)
    const creado = await createUserFromAdmin({
      email: nuevoEmail.trim().toLowerCase(),
      password: nuevoPassword,
      nombre: nuevoNombre.trim(),
      rol: nuevoRol,
      estado: nuevoEstado
    })

    setCreating(false)

    if (!creado || creado.error) {
      return toast.error(creado?.error || "No se pudo crear el usuario")
    }

    setNuevoNombre("")
    setNuevoEmail("")
    setNuevoPassword("")
    setNuevoRol("vendedor")
    setNuevoEstado("activo")
    if (creado.requiresEmailConfirmation) {
      toast.success("Usuario creado. Debe confirmar su correo antes de iniciar sesión")
    } else {
      toast.success("Usuario creado")
    }
    cargarUsuarios()
  }

  const eliminarUsuario = async (usuarioFila) => {
    if (String(user?.id) === String(usuarioFila.id)) {
      return toast.error("No puedes eliminar tu propio usuario")
    }

    const confirmar = window.confirm(
      `¿Eliminar permanentemente el usuario ${usuarioFila.email}?\n\nEsto borrará su acceso, perfil y registros relacionados por usuario_id.`
    )
    if (!confirmar) return

    setDeletingId(usuarioFila.id)
    const ok = await deleteUserProfile(usuarioFila.id)
    setDeletingId(null)

    if (!ok) {
      return toast.error("No se pudo eliminar el usuario")
    }

    toast.success("Usuario eliminado")
    cargarUsuarios()
  }

  if (loading) {
    return (
      <div className="bg-white shadow rounded p-6">
        <p className="text-gray-600">Cargando...</p>
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-4">Gestión de usuarios</h1>

      <div className="bg-white shadow rounded p-4 mb-6">
        <h2 className="font-bold mb-3">Crear usuario</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            placeholder="Nombre"
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            className="border p-2 rounded"
          />
          <input
            type="email"
            placeholder="Email"
            value={nuevoEmail}
            onChange={(e) => setNuevoEmail(e.target.value)}
            className="border p-2 rounded"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={nuevoPassword}
            onChange={(e) => setNuevoPassword(e.target.value)}
            className="border p-2 rounded"
          />
          <select
            value={nuevoRol}
            onChange={(e) => setNuevoRol(e.target.value)}
            className="border p-2 rounded"
          >
            {ROLES.map((rol) => (
              <option key={rol} value={rol}>
                {rol}
              </option>
            ))}
          </select>
          <select
            value={nuevoEstado}
            onChange={(e) => setNuevoEstado(e.target.value)}
            className="border p-2 rounded"
          >
            {ESTADOS.map((estado) => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={crearUsuario}
          disabled={creating}
          className="bg-green-600 text-white px-4 py-2 rounded mt-3 disabled:opacity-60"
        >
          {creating ? "Creando..." : "Crear usuario"}
        </button>
      </div>

      <div className="bg-white shadow rounded p-4">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="py-2">{u.nombre || "-"}</td>
                <td>{u.email}</td>
                <td>
                  <select
                    value={u.rol || "operador"}
                    onChange={(e) => cambiarCampo(u.id, "rol", e.target.value)}
                    className="border p-1 rounded"
                  >
                    {ROLES.map((rol) => (
                      <option key={rol} value={rol}>
                        {rol}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    value={u.estado || "activo"}
                    onChange={(e) => cambiarCampo(u.id, "estado", e.target.value)}
                    className="border p-1 rounded"
                  >
                    {ESTADOS.map((estado) => (
                      <option key={estado} value={estado}>
                        {estado}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <div className="flex gap-2">
                    <button
                      onClick={() => guardarFila(u)}
                      disabled={savingId === u.id}
                      className="bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-60"
                    >
                      {savingId === u.id ? "Guardando..." : "Guardar"}
                    </button>
                    <button
                      onClick={() => eliminarUsuario(u)}
                      disabled={deletingId === u.id}
                      className="bg-red-600 text-white px-3 py-1 rounded disabled:opacity-60"
                    >
                      {deletingId === u.id ? "Eliminando..." : "Eliminar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
