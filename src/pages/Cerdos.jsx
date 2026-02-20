import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import toast from "react-hot-toast"
import { supabase } from "../lib/supabase"
import { formatNumber, parseNumber } from "../utils/formatNumber"

const estadoOpciones = ["vivo", "vendido_pie", "vendido_canal", "vendido_kilo", "muerto"]
const estadosVendidos = ["vendido_pie", "vendido_canal", "vendido_kilo"]
const tabs = ["vivos", "muertos", "vendidos"]

const formatearDinero = (valor) => Number(valor || 0).toLocaleString("es-CO")

const nombreTipoVenta = (estado) => {
  if (estado === "vendido_pie") return "Pie"
  if (estado === "vendido_canal") return "Canal"
  if (estado === "vendido_kilo") return "Libriado"
  return "-"
}

export default function Cerdos() {
  const navigate = useNavigate()
  const [cerdos, setCerdos] = useState([])
  const [ventas, setVentas] = useState([])
  const [gastos, setGastos] = useState([])
  const [historial, setHistorial] = useState([])
  const [historialId, setHistorialId] = useState(null)
  const [tabActiva, setTabActiva] = useState("vivos")

  const [peso, setPeso] = useState("")
  const [fechaIngreso, setFechaIngreso] = useState(new Date().toISOString().split("T")[0])
  const [codigo, setCodigo] = useState("")
  const [costoCompra, setCostoCompra] = useState("")
  const [observaciones, setObservaciones] = useState("")

  const [editId, setEditId] = useState(null)
  const [editPeso, setEditPeso] = useState("")
  const [editEstado, setEditEstado] = useState("vivo")
  const [editPesoFinal, setEditPesoFinal] = useState("")
  const [editFechaSalida, setEditFechaSalida] = useState("")
  const [editCausaMuerte, setEditCausaMuerte] = useState("")

  const [etiquetasCerdoId, setEtiquetasCerdoId] = useState(null)
  const [etiquetas, setEtiquetas] = useState([])
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState("")

  async function fetchData() {
    const [cerdosRes, ventasRes, gastosRes] = await Promise.all([
      supabase.from("cerdos").select("*").order("id"),
      supabase
        .from("ventas")
        .select(`
          id, total, fecha, estado,
          detalle_venta(cerdo_id),
          ventas_libriado(id)
        `)
        .order("created_at", { ascending: false }),
      supabase.from("gastos").select("cerdo_id, monto")
    ])

    setCerdos(cerdosRes.data || [])
    setVentas(ventasRes.data || [])
    setGastos(gastosRes.data || [])
  }

  useEffect(() => {
    fetchData()
  }, [])

  const gastosPorCerdo = useMemo(() => {
    const map = {}
    ;(gastos || []).forEach((gasto) => {
      const cerdoId = gasto.cerdo_id
      map[cerdoId] = (map[cerdoId] || 0) + Number(gasto.monto || 0)
    })
    return map
  }, [gastos])

  const ventaPorCerdo = useMemo(() => {
    const map = {}
    ;(ventas || []).forEach((venta) => {
      const detalles = venta.detalle_venta || []
      detalles.forEach((detalle) => {
        if (!detalle?.cerdo_id || map[detalle.cerdo_id]) return
        map[detalle.cerdo_id] = {
          ventaId: venta.id,
          precioFinal: Number(venta.total || 0),
          fechaVenta: venta.fecha,
          estadoCobro: venta.estado,
          esLibriado: (venta.ventas_libriado || []).length > 0
        }
      })
    })
    return map
  }, [ventas])

  const cerdosVivos = useMemo(() => cerdos.filter((c) => c.estado === "vivo"), [cerdos])
  const cerdosMuertos = useMemo(() => cerdos.filter((c) => c.estado === "muerto"), [cerdos])
  const cerdosVendidos = useMemo(() => cerdos.filter((c) => estadosVendidos.includes(c.estado)), [cerdos])

  const resumen = useMemo(() => {
    const pesoPromedio = cerdosVivos.length
      ? cerdosVivos.reduce((acc, c) => acc + Number(c.peso || 0), 0) / cerdosVivos.length
      : 0

    return {
      vivos: cerdosVivos.length,
      vendidos: cerdosVendidos.length,
      muertos: cerdosMuertos.length,
      pesoPromedio: Number(pesoPromedio.toFixed(1))
    }
  }, [cerdosVivos, cerdosVendidos, cerdosMuertos])

  const agregarCerdo = async () => {
    if (!peso) return toast.error("Ingrese peso")
    if (parseNumber(peso) <= 0) return toast.error("El peso debe ser mayor a 0")

    const { error } = await supabase.from("cerdos").insert([
      {
        peso: parseNumber(peso),
        estado: "vivo",
        fecha_ingreso: fechaIngreso,
        codigo: codigo || null,
        costo_compra: parseNumber(costoCompra) || null,
        observaciones: observaciones || null
      }
    ])

    if (error) return toast.error(error.message)

    setPeso("")
    setCodigo("")
    setCostoCompra("")
    setObservaciones("")
    fetchData()
  }

  const iniciarEdicion = (cerdo) => {
    setEditId(cerdo.id)
    setEditPeso(formatNumber(cerdo.peso || ""))
    setEditEstado(cerdo.estado || "vivo")
    setEditPesoFinal(formatNumber(cerdo.peso_final || ""))
    setEditFechaSalida(cerdo.fecha_salida || "")
    setEditCausaMuerte(cerdo.causa_muerte || "")
  }

  const cancelarEdicion = () => {
    setEditId(null)
    setEditPeso("")
    setEditEstado("vivo")
    setEditPesoFinal("")
    setEditFechaSalida("")
    setEditCausaMuerte("")
  }

  const guardarEdicion = async (cerdo) => {
    if (parseNumber(editPeso) <= 0) return toast.error("El peso inicial debe ser mayor a 0")
    if (editPesoFinal && parseNumber(editPesoFinal) <= 0) return toast.error("El peso final debe ser mayor a 0")

    const cambios = {
      peso: parseNumber(editPeso),
      estado: editEstado,
      peso_final: parseNumber(editPesoFinal) || null,
      fecha_salida: editFechaSalida || null,
      causa_muerte: editCausaMuerte || null
    }

    const { error } = await supabase.from("cerdos").update(cambios).eq("id", cerdo.id)
    if (error) return toast.error(error.message)

    await supabase.from("movimientos_cerdos").insert([
      {
        cerdo_id: cerdo.id,
        tipo: "actualizacion",
        descripcion: `Peso: ${cerdo.peso} -> ${editPeso}, Estado: ${cerdo.estado} -> ${editEstado}`,
        fecha: new Date().toISOString().split("T")[0]
      }
    ])

    cancelarEdicion()
    fetchData()
  }

  const cambiarEstado = async (cerdo, nuevoEstado) => {
    const { error } = await supabase.from("cerdos").update({ estado: nuevoEstado }).eq("id", cerdo.id)
    if (error) return toast.error(error.message)

    await supabase.from("movimientos_cerdos").insert([
      {
        cerdo_id: cerdo.id,
        tipo: "estado",
        descripcion: `Estado: ${cerdo.estado} -> ${nuevoEstado}`,
        fecha: new Date().toISOString().split("T")[0]
      }
    ])

    fetchData()
  }

  const verHistorial = async (cerdoId) => {
    if (historialId === cerdoId) {
      setHistorialId(null)
      setHistorial([])
      return
    }

    const { data } = await supabase
      .from("movimientos_cerdos")
      .select("*")
      .eq("cerdo_id", cerdoId)
      .order("fecha", { ascending: false })

    setHistorialId(cerdoId)
    setHistorial(data || [])
  }

  const abrirGestorEtiquetas = async (cerdoId) => {
    if (etiquetasCerdoId === cerdoId) {
      setEtiquetasCerdoId(null)
      setEtiquetas([])
      return
    }

    const { data } = await supabase
      .from("etiquetas_cerdos")
      .select("*")
      .eq("cerdo_id", cerdoId)
      .order("created_at", { ascending: false })

    setEtiquetasCerdoId(cerdoId)
    setEtiquetas(data || [])
  }

  const agregarEtiqueta = async () => {
    if (!nuevaEtiqueta.trim()) return toast.error("Ingrese una etiqueta")

    const { error } = await supabase.from("etiquetas_cerdos").insert([
      {
        cerdo_id: etiquetasCerdoId,
        etiqueta: nuevaEtiqueta.trim()
      }
    ])

    if (error) return toast.error(error.message)

    setNuevaEtiqueta("")
    abrirGestorEtiquetas(etiquetasCerdoId)
  }

  const eliminarEtiqueta = async (etiquetaId) => {
    const { error } = await supabase.from("etiquetas_cerdos").delete().eq("id", etiquetaId)

    if (error) return toast.error(error.message)

    abrirGestorEtiquetas(etiquetasCerdoId)
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Cerdos</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white shadow rounded p-4">
          <p className="text-gray-500">Vivos</p>
          <p className="text-2xl font-bold">{resumen.vivos}</p>
        </div>
        <div className="bg-white shadow rounded p-4">
          <p className="text-gray-500">Vendidos</p>
          <p className="text-2xl font-bold">{resumen.vendidos}</p>
        </div>
        <div className="bg-white shadow rounded p-4">
          <p className="text-gray-500">Sacrificados</p>
          <p className="text-2xl font-bold">{resumen.muertos}</p>
        </div>
        <div className="bg-white shadow rounded p-4">
          <p className="text-gray-500">Peso promedio</p>
          <p className="text-2xl font-bold">{resumen.pesoPromedio} kg</p>
        </div>
      </div>

      <div className="bg-white shadow rounded p-4 mb-6">
        <h2 className="font-bold mb-3">Agregar cerdo</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder="Peso"
            value={peso}
            onChange={(e) => setPeso(formatNumber(e.target.value))}
            className="border p-2 rounded"
          />
          <input
            type="date"
            value={fechaIngreso}
            onChange={(e) => setFechaIngreso(e.target.value)}
            className="border p-2 rounded"
          />
          <input
            placeholder="Codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            className="border p-2 rounded"
          />
          <input
            type="text"
            placeholder="Costo compra"
            value={costoCompra}
            onChange={(e) => setCostoCompra(formatNumber(e.target.value))}
            className="border p-2 rounded"
          />
          <input
            placeholder="Observaciones"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="border p-2 rounded"
          />
        </div>
        <button
          onClick={agregarCerdo}
          className="bg-green-600 text-white px-4 py-2 rounded mt-3"
        >
          Agregar
        </button>
      </div>

      <div className="bg-white shadow rounded p-2 mb-4 inline-flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setTabActiva(tab)}
            className={`px-4 py-2 rounded text-sm font-semibold ${
              tabActiva === tab ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
            }`}
          >
            {tab === "vivos" ? "Vivos" : tab === "muertos" ? "Muertos" : "Vendidos"}
          </button>
        ))}
      </div>

      <div className="bg-white shadow rounded p-4">
        {tabActiva === "vivos" && (
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>ID</th>
                <th>Código</th>
                <th>Peso</th>
                <th>Fecha ingreso</th>
                <th>Costo compra</th>
                <th>Gastos</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cerdosVivos.map((cerdo) => (
                <tr key={cerdo.id} className="border-t">
                  <td>{cerdo.id}</td>
                  <td>{cerdo.codigo || "-"}</td>
                  <td>
                    {editId === cerdo.id ? (
                      <input
                        type="number"
                        value={editPeso}
                        onChange={(e) => setEditPeso(e.target.value)}
                        className="border p-1 rounded w-24"
                      />
                    ) : (
                      `${cerdo.peso} lb`
                    )}
                  </td>
                  <td>{cerdo.fecha_ingreso || "-"}</td>
                  <td>${formatearDinero(cerdo.costo_compra)}</td>
                  <td>${formatearDinero(gastosPorCerdo[cerdo.id])}</td>
                  <td>
                    {editId === cerdo.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => guardarEdicion(cerdo)}
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
                          onClick={() => iniciarEdicion(cerdo)}
                          className="bg-blue-600 text-white px-2 py-1 rounded"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => navigate("/ventas/nueva", { state: { cerdoId: cerdo.id } })}
                          className="bg-green-600 text-white px-2 py-1 rounded"
                        >
                          Vender
                        </button>
                        <button
                          onClick={() => cambiarEstado(cerdo, "muerto")}
                          className="bg-red-600 text-white px-2 py-1 rounded"
                        >
                          Marcar muerto
                        </button>
                        <button
                          onClick={() => verHistorial(cerdo.id)}
                          className="bg-gray-200 px-2 py-1 rounded"
                        >
                          Historial
                        </button>
                        <button
                          onClick={() => abrirGestorEtiquetas(cerdo.id)}
                          className="bg-purple-600 text-white px-2 py-1 rounded"
                        >
                          Etiquetas
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tabActiva === "muertos" && (
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>ID</th>
                <th>Código</th>
                <th>Peso</th>
                <th>Fecha ingreso</th>
                <th>Costo compra</th>
                <th>Gastos</th>
                <th>Observaciones</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cerdosMuertos.map((cerdo) => (
                <tr key={cerdo.id} className="border-t">
                  <td>{cerdo.id}</td>
                  <td>{cerdo.codigo || "-"}</td>
                  <td>{cerdo.peso} lb</td>
                  <td>{cerdo.fecha_ingreso || "-"}</td>
                  <td>${formatearDinero(cerdo.costo_compra)}</td>
                  <td>${formatearDinero(gastosPorCerdo[cerdo.id])}</td>
                  <td>{cerdo.observaciones || "-"}</td>
                  <td>
                    <button
                      onClick={() => verHistorial(cerdo.id)}
                      className="bg-gray-200 px-2 py-1 rounded"
                    >
                      Historial
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tabActiva === "vendidos" && (
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>ID</th>
                <th>Código</th>
                <th>Tipo venta</th>
                <th>Fecha venta</th>
                <th>Precio final</th>
                <th>Costo compra</th>
                <th>Gastos</th>
                <th>Ganancia</th>
                <th>Cobro</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cerdosVendidos.map((cerdo) => {
                const ventaInfo = ventaPorCerdo[cerdo.id]
                const precioFinal = Number(ventaInfo?.precioFinal || 0)
                const costo = Number(cerdo.costo_compra || 0)
                const gasto = Number(gastosPorCerdo[cerdo.id] || 0)
                const ganancia = precioFinal - costo - gasto

                return (
                  <tr key={cerdo.id} className="border-t">
                    <td>{cerdo.id}</td>
                    <td>{cerdo.codigo || "-"}</td>
                    <td>{nombreTipoVenta(cerdo.estado)}</td>
                    <td>{ventaInfo?.fechaVenta || "-"}</td>
                    <td>${formatearDinero(precioFinal)}</td>
                    <td>${formatearDinero(costo)}</td>
                    <td>${formatearDinero(gasto)}</td>
                    <td className={ganancia >= 0 ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>
                      ${formatearDinero(Math.abs(ganancia))} {ganancia >= 0 ? "" : "(Pérdida)"}
                    </td>
                    <td>{ventaInfo?.estadoCobro || "-"}</td>
                    <td>
                      <button
                        onClick={() => verHistorial(cerdo.id)}
                        className="bg-gray-200 px-2 py-1 rounded"
                      >
                        Historial
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {historialId && (
          <div className="mt-4">
            <h3 className="font-bold mb-2">Historial del cerdo #{historialId}</h3>
            {historial.length ? (
              <ul className="text-sm space-y-1">
                {historial.map((m) => (
                  <li key={m.id} className="border-b pb-1">
                    {m.fecha} — {m.tipo}: {m.descripcion}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Sin movimientos.</p>
            )}
          </div>
        )}

        {editId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
              <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
                <h2 className="text-xl font-bold">Editar Cerdo #{editId}</h2>
                <button onClick={cancelarEdicion} className="text-2xl">×</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Peso inicial (lb)</label>
                    <input
                      type="text"
                      value={editPeso}
                      onChange={(e) => setEditPeso(formatNumber(e.target.value))}
                      className="border p-2 rounded w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Peso final (lb)</label>
                    <input
                      type="text"
                      value={editPesoFinal}
                      onChange={(e) => setEditPesoFinal(formatNumber(e.target.value))}
                      className="border p-2 rounded w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Estado</label>
                    <select
                      value={editEstado}
                      onChange={(e) => setEditEstado(e.target.value)}
                      className="border p-2 rounded w-full"
                    >
                      {estadoOpciones.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Fecha salida</label>
                    <input
                      type="date"
                      value={editFechaSalida}
                      onChange={(e) => setEditFechaSalida(e.target.value)}
                      className="border p-2 rounded w-full"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Causa muerte</label>
                  <input
                    type="text"
                    value={editCausaMuerte}
                    onChange={(e) => setEditCausaMuerte(e.target.value)}
                    placeholder="Ej: Enfermedad, accidente..."
                    className="border p-2 rounded w-full"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => guardarEdicion(cerdos.find(c => c.id === editId))}
                    className="bg-blue-600 text-white px-4 py-2 rounded flex-1"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={cancelarEdicion}
                    className="bg-gray-300 px-4 py-2 rounded flex-1"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {etiquetasCerdoId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="bg-purple-600 text-white p-4 flex justify-between items-center">
                <h2 className="text-xl font-bold">Etiquetas del Cerdo #{etiquetasCerdoId}</h2>
                <button onClick={() => abrirGestorEtiquetas(etiquetasCerdoId)} className="text-2xl">×</button>
              </div>
              <div className="p-6 space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nuevaEtiqueta}
                    onChange={(e) => setNuevaEtiqueta(e.target.value)}
                    placeholder="Ej: Enfermo, Lento crecimiento, etc."
                    className="border p-2 rounded flex-1"
                    onKeyPress={(e) => e.key === "Enter" && agregarEtiqueta()}
                  />
                  <button
                    onClick={agregarEtiqueta}
                    className="bg-purple-600 text-white px-3 py-2 rounded"
                  >
                    Agregar
                  </button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {etiquetas.length > 0 ? (
                    etiquetas.map((eti) => (
                      <div key={eti.id} className="flex items-center justify-between bg-gray-100 p-2 rounded">
                        <span className="text-sm">{eti.etiqueta}</span>
                        <button
                          onClick={() => eliminarEtiqueta(eti.id)}
                          className="text-red-600 hover:text-red-800 font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">Sin etiquetas aún</p>
                  )}
                </div>

                <button
                  onClick={() => abrirGestorEtiquetas(etiquetasCerdoId)}
                  className="w-full bg-gray-300 px-4 py-2 rounded"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
