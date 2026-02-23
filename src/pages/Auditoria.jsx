import { useEffect, useMemo, useState } from "react"
import { Navigate } from "react-router-dom"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { canManageUsersByRole } from "../lib/permissions"
import { listAuditoria } from "../services/auditService"
import { listUsers } from "../services/authService"

export default function Auditoria() {
  const { userProfile, loading } = useCurrentUser()
  const isAdmin = canManageUsersByRole(userProfile?.rol)

  const [registros, setRegistros] = useState([])
  const [usuarios, setUsuarios] = useState([])

  const [filtroModulo, setFiltroModulo] = useState("todos")
  const [filtroUsuario, setFiltroUsuario] = useState("todos")
  const [fechaInicio, setFechaInicio] = useState("")
  const [fechaFin, setFechaFin] = useState("")

  const modulos = useMemo(() => {
    const setModulos = new Set((registros || []).map((r) => r.modulo).filter(Boolean))
    return ["todos", ...Array.from(setModulos)]
  }, [registros])

  const cargarAuditoria = async () => {
    const data = await listAuditoria({
      modulo: filtroModulo,
      usuarioId: filtroUsuario,
      fechaInicio,
      fechaFin
    })
    setRegistros(data)
  }

  useEffect(() => {
    if (!isAdmin) return

    const init = async () => {
      const dataUsuarios = await listUsers()
      setUsuarios(dataUsuarios || [])
      await cargarAuditoria()
    }

    init()
  }, [isAdmin])

  useEffect(() => {
    if (!isAdmin) return
    cargarAuditoria()
  }, [filtroModulo, filtroUsuario, fechaInicio, fechaFin])

  if (loading) {
    return <div className="p-6">Cargando...</div>
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Auditoría</h1>

      <div className="bg-white shadow rounded p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <select
          value={filtroModulo}
          onChange={(e) => setFiltroModulo(e.target.value)}
          className="border p-2 rounded"
        >
          {modulos.map((modulo) => (
            <option key={modulo} value={modulo}>
              {modulo === "todos" ? "Todos los módulos" : modulo}
            </option>
          ))}
        </select>

        <select
          value={filtroUsuario}
          onChange={(e) => setFiltroUsuario(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="todos">Todos los usuarios</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre || u.email}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
          className="border p-2 rounded"
        />

        <input
          type="date"
          value={fechaFin}
          onChange={(e) => setFechaFin(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      <div className="bg-white shadow rounded p-4 overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b">
              <th className="py-2">Fecha</th>
              <th>Usuario</th>
              <th>Módulo</th>
              <th>Acción</th>
              <th>Entidad</th>
              <th>Descripción</th>
            </tr>
          </thead>
          <tbody>
            {registros.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString("es-CO")}</td>
                <td>{r.usuarios?.nombre || r.usuarios?.email || r.usuario_id || "-"}</td>
                <td className="uppercase">{r.modulo}</td>
                <td>{r.accion}</td>
                <td>{r.entidad}{r.entidad_id ? ` #${r.entidad_id}` : ""}</td>
                <td>
                  <p>{r.descripcion || "-"}</p>
                  {r.metadata && (
                    <pre className="text-xs mt-1 bg-gray-50 p-2 rounded whitespace-pre-wrap">
                      {JSON.stringify(r.metadata, null, 2)}
                    </pre>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}