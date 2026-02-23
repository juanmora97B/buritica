import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { supabase } from "../lib/supabase"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { canEditByRole } from "../lib/permissions"
import { formatNumber, parseNumber } from "../utils/formatNumber"
import { registrarAuditoria } from "../services/auditService"

const tipos = ["Alimento", "Medicamentos", "Transporte", "Servicios", "Otros"]

export default function Gastos() {
  const { user, userProfile } = useCurrentUser()
  const canEdit = canEditByRole(userProfile?.rol)
  const [gastos, setGastos] = useState([])
  const [descripcion, setDescripcion] = useState("")
  const [monto, setMonto] = useState("")
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0])
  const [tipo, setTipo] = useState("Alimento")
  const [mesFiltro, setMesFiltro] = useState("")
  const [tipoFiltro, setTipoFiltro] = useState("todos")
  const [cerdoFiltro, setCerdoFiltro] = useState("todos")

  const [distribuir, setDistribuir] = useState(false)
  const [cerdos, setCerdos] = useState([])
  const [cerdosSeleccionados, setCerdosSeleccionados] = useState([])

  const [editId, setEditId] = useState(null)
  const [editDescripcion, setEditDescripcion] = useState("")
  const [editMonto, setEditMonto] = useState("")
  const [editFecha, setEditFecha] = useState("")
  const [editTipo, setEditTipo] = useState("Alimento")

  async function fetchCerdos() {
    const { data } = await supabase
      .from("cerdos")
      .select("id, codigo, peso, observaciones")
      .order("id")
    setCerdos(data || [])
  }

  async function fetchGastos() {
    let query = supabase
      .from("gastos")
      .select("*, cerdos(id, codigo, observaciones)")
      .order("fecha", { ascending: false })

    if (mesFiltro) {
      const [year, month] = mesFiltro.split("-")
      const start = `${year}-${month}-01`
      const endDate = new Date(Number(year), Number(month), 0)
      const end = endDate.toISOString().split("T")[0]
      query = query.gte("fecha", start).lte("fecha", end)
    }

    if (tipoFiltro !== "todos") {
      query = query.eq("tipo", tipoFiltro)
    }

    if (cerdoFiltro === "general") {
      query = query.is("cerdo_id", null)
    } else if (cerdoFiltro !== "todos") {
      query = query.eq("cerdo_id", Number(cerdoFiltro))
    }

    const { data } = await query
    setGastos(data || [])
  }

  useEffect(() => {
    fetchGastos()
  }, [mesFiltro, tipoFiltro, cerdoFiltro])

  useEffect(() => {
    fetchCerdos()
  }, [])

  const agregarGasto = async () => {
    if (!canEdit) return toast.error("No tienes permisos para editar información")
    if (!descripcion || !monto) return toast.error("Ingrese descripcion y monto")
    if (parseNumber(monto) <= 0) return toast.error("El monto debe ser mayor a 0")

    if (distribuir && cerdosSeleccionados.length === 0) {
      return toast.error("Seleccione al menos un cerdo para distribuir el gasto")
    }

    // Si se distribuye entre varios cerdos
    if (distribuir && cerdosSeleccionados.length > 0) {
      const montoPorCerdo = parseNumber(monto) / cerdosSeleccionados.length

      const gastosArray = cerdosSeleccionados.map((cerdoId) => ({
        descripcion: `${descripcion} (distribuido entre ${cerdosSeleccionados.length} cerdos)`,
        monto: Math.round(montoPorCerdo),
        fecha,
        tipo,
        cerdo_id: cerdoId,
        usuario_id: user?.id || null
      }))

      const { error } = await supabase.from("gastos").insert(gastosArray)
      if (error) return toast.error(error.message)

      await registrarAuditoria({
        usuarioId: user?.id || null,
        modulo: "gastos",
        accion: "create_distribuido",
        entidad: "gastos",
        descripcion: `Creó gasto distribuido en ${cerdosSeleccionados.length} cerdos`,
        metadata: { descripcion, monto: parseNumber(monto), tipo, cerdosSeleccionados }
      })
    } else {
      // Gasto normal sin distribución
      const { error } = await supabase.from("gastos").insert([
        {
          descripcion,
          monto: parseNumber(monto),
          fecha,
          tipo,
          usuario_id: user?.id || null
        }
      ])
      if (error) return toast.error(error.message)

      await registrarAuditoria({
        usuarioId: user?.id || null,
        modulo: "gastos",
        accion: "create",
        entidad: "gastos",
        descripcion: "Creó gasto",
        metadata: { descripcion, monto: parseNumber(monto), tipo, fecha }
      })
    }

    setDescripcion("")
    setMonto("")
    setDistribuir(false)
    setCerdosSeleccionados([])
    fetchGastos()
  }

  const iniciarEdicion = (gasto) => {
    if (!canEdit) return toast.error("No tienes permisos para editar información")
    setEditId(gasto.id)
    setEditDescripcion(gasto.descripcion || "")
    setEditMonto(formatNumber(gasto.monto || ""))
    setEditFecha(gasto.fecha || "")
    setEditTipo(gasto.tipo || "Alimento")
  }

  const cancelarEdicion = () => {
    setEditId(null)
    setEditDescripcion("")
    setEditMonto("")
    setEditFecha("")
    setEditTipo("Alimento")
  }

  const guardarEdicion = async (id) => {
    if (!canEdit) return toast.error("No tienes permisos para editar información")
    if (parseNumber(editMonto) <= 0) return toast.error("El monto debe ser mayor a 0")

    const { error } = await supabase
      .from("gastos")
      .update({
        descripcion: editDescripcion,
        monto: parseNumber(editMonto),
        fecha: editFecha,
        tipo: editTipo
      })
      .eq("id", id)

    if (error) return toast.error(error.message)

    await registrarAuditoria({
      usuarioId: user?.id || null,
      modulo: "gastos",
      accion: "update",
      entidad: "gastos",
      entidadId: String(id),
      descripcion: "Actualizó gasto",
      metadata: {
        descripcion: editDescripcion,
        monto: parseNumber(editMonto),
        tipo: editTipo,
        fecha: editFecha
      }
    })

    cancelarEdicion()
    fetchGastos()
  }

  const eliminarGasto = async (id) => {
    if (!canEdit) return toast.error("No tienes permisos para editar información")
    const confirmar = window.confirm("¿Eliminar gasto?")
    if (!confirmar) return

    const { error } = await supabase.from("gastos").delete().eq("id", id)
    if (error) return toast.error(error.message)

    await registrarAuditoria({
      usuarioId: user?.id || null,
      modulo: "gastos",
      accion: "delete",
      entidad: "gastos",
      entidadId: String(id),
      descripcion: "Eliminó gasto"
    })

    setGastos(gastos.filter((g) => g.id !== id))
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Gastos</h1>

      <div className="bg-white shadow rounded p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            placeholder="Descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="border p-2 rounded"
          />
          <input
            type="text"
            placeholder="Monto"
            value={monto}
            onChange={(e) => setMonto(formatNumber(e.target.value))}
            className="border p-2 rounded"
          />
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="border p-2 rounded"
          />
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="border p-2 rounded"
          >
            {tipos.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="mt-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={distribuir}
              onChange={(e) => {
                setDistribuir(e.target.checked)
                if (!e.target.checked) setCerdosSeleccionados([])
              }}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium">Distribuir gasto entre varios cerdos</span>
          </label>
        </div>

        {distribuir && (
          <div className="mt-3 p-3 bg-blue-50 rounded">
            <p className="text-sm font-medium mb-2">
              Selecciona los cerdos (el monto se dividirá equitativamente):
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto">
              {cerdos.map((cerdo) => (
                <label key={cerdo.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={cerdosSeleccionados.includes(cerdo.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCerdosSeleccionados([...cerdosSeleccionados, cerdo.id])
                      } else {
                        setCerdosSeleccionados(cerdosSeleccionados.filter((id) => id !== cerdo.id))
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <span>
                    Cerdo #{cerdo.id} {cerdo.codigo ? `(${cerdo.codigo})` : ""} - {cerdo.peso}lb
                  </span>
                </label>
              ))}
            </div>
            {cerdosSeleccionados.length > 0 && monto && (
              <p className="mt-2 text-sm font-bold text-blue-600">
                Monto por cerdo: ${(Number(monto) / cerdosSeleccionados.length).toFixed(2)}
              </p>
            )}
          </div>
        )}

        <button
          onClick={agregarGasto}
          className="bg-red-600 text-white px-4 py-2 rounded mt-3"
        >
          Agregar
        </button>
      </div>

      <div className="bg-white shadow rounded p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-600">Mes</label>
          <input
            type="month"
            value={mesFiltro}
            onChange={(e) => setMesFiltro(e.target.value)}
            className="border p-2 rounded"
          />

          <label className="text-sm text-gray-600">Categoria</label>
          <select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="todos">Todas</option>
            {tipos.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <label className="text-sm text-gray-600">Cerdo</label>
          <select
            value={cerdoFiltro}
            onChange={(e) => setCerdoFiltro(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="todos">Todos</option>
            <option value="general">Generales (sin cerdo)</option>
            {cerdos.map((cerdo) => (
              <option key={cerdo.id} value={cerdo.id}>
                Cerdo #{cerdo.id} {cerdo.codigo ? `(${cerdo.codigo})` : ""}
              </option>
            ))}
          </select>

          {(mesFiltro || tipoFiltro !== "todos" || cerdoFiltro !== "todos") && (
            <button
              onClick={() => {
                setMesFiltro("")
                setTipoFiltro("todos")
                setCerdoFiltro("todos")
              }}
              className="bg-gray-200 px-3 py-1 rounded"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      <div className="bg-white shadow rounded p-4">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Descripcion</th>
              <th>Categoria</th>
              <th>Cerdo</th>
              <th>Monto</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {gastos.map((g) => (
              <tr key={g.id} className="border-t">
                <td>
                  {editId === g.id ? (
                    <input
                      type="date"
                      value={editFecha}
                      onChange={(e) => setEditFecha(e.target.value)}
                      className="border p-1 rounded"
                    />
                  ) : (
                    g.fecha
                  )}
                </td>
                <td>
                  {editId === g.id ? (
                    <input
                      value={editDescripcion}
                      onChange={(e) => setEditDescripcion(e.target.value)}
                      className="border p-1 rounded"
                    />
                  ) : (
                    g.descripcion
                  )}
                </td>
                <td>
                  {editId === g.id ? (
                    <select
                      value={editTipo}
                      onChange={(e) => setEditTipo(e.target.value)}
                      className="border p-1 rounded"
                    >
                      {tipos.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  ) : (
                    g.tipo
                  )}
                </td>
                <td>
                  {g.cerdos ? (
                    <span className="text-sm bg-green-100 px-2 py-1 rounded">
                      Cerdo #{g.cerdos.id} {g.cerdos.codigo ? `(${g.cerdos.codigo})` : ""}
                      {g.cerdos.observaciones ? ` - ${g.cerdos.observaciones}` : ""}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm">General</span>
                  )}
                </td>
                <td>
                  {editId === g.id ? (
                    <input
                      type="text"
                      value={editMonto}
                      onChange={(e) => setEditMonto(formatNumber(e.target.value))}
                      className="border p-1 rounded"
                    />
                  ) : (
                    `$${Number(g.monto).toLocaleString('es-CO')}`
                  )}
                </td>
                <td>
                  {editId === g.id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => guardarEdicion(g.id)}
                        className="bg-blue-600 text-white px-2 py-1 rounded"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={cancelarEdicion}
                        className="bg-gray-300 px-2 py-1 rounded"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => iniciarEdicion(g)}
                        className="bg-blue-600 text-white px-2 py-1 rounded"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => eliminarGasto(g.id)}
                        className="bg-red-600 text-white px-2 py-1 rounded"
                      >
                        Eliminar
                      </button>
                    </div>
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
