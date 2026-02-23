import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { supabase } from "../lib/supabase"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { canEditByRole } from "../lib/permissions"
import { formatNumber, parseNumber } from "../utils/formatNumber"
import { registrarAuditoria } from "../services/auditService"

const sumarPagos = (pagos) => pagos.reduce((acc, p) => acc + Number(p.monto || 0), 0)

export default function Fiados() {
  const { user, userProfile } = useCurrentUser()
  const canEdit = canEditByRole(userProfile?.rol)
  const [ventasAgrupadas, setVentasAgrupadas] = useState([])
  const [abonosActivos, setAbonosActivos] = useState({})
  const [historialActivo, setHistorialActivo] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    setCargando(true)
    setError(null)
    try {
      await cargarFiadosAgrupados()
    } catch (err) {
      setError(err.message)
      toast.error(err.message || "Error cargando fiados")
    } finally {
      setCargando(false)
    }
  }

  const cargarFiadosAgrupados = async () => {
    // Obtener ventas normales fiadas (pie/canal)
    const { data: ventasNormales, error: ventasError } = await supabase
      .from("ventas")
      .select(`
        id, total, fecha, estado,
        clientes(id, nombre),
        pagos(id, monto, fecha, metodo),
        detalle_venta(cerdo_id, cantidad, cerdos(id, peso, costo_compra, observaciones, codigo)),
        ventas_libriado(id)
      `)
      .in("estado", ["pendiente", "parcial"])
      .order("created_at", { ascending: false })

    if (ventasError) throw ventasError

    // Filtrar solo las ventas que NO son libriado (que no tengan registros en ventas_libriado)
    const ventasNormalesFiltradas = (ventasNormales || []).filter(
      (v) => !v.ventas_libriado || v.ventas_libriado.length === 0
    )

    // Obtener ventas libriado con fiados
    const { data: ventasLibriado, error: libError } = await supabase
      .from("ventas")
      .select(`
        id, total, fecha,
        detalle_venta(cerdo_id, cerdos(id, peso, costo_compra, observaciones, codigo)),
        ventas_libriado(id, cliente_id, subtotal, kilos, precio_kilo, estado, clientes(id, nombre))
      `)

    if (libError) throw libError

    // Filtrar solo las que tienen al menos un fiado
    const ventasLibriadoConFiados = (ventasLibriado || []).filter(
      (v) => (v.ventas_libriado || []).some((lib) => lib.estado === "fiado")
    )

    // Obtener gastos de todos los cerdos involucrados
    const todosLosCerdos = [
      ...(ventasNormalesFiltradas || []).map((v) => v.detalle_venta?.[0]?.cerdo_id),
      ...(ventasLibriadoConFiados || []).map((v) => v.detalle_venta?.[0]?.cerdo_id)
    ].filter(Boolean)

    let gastosMap = {}
    if (todosLosCerdos.length > 0) {
      const { data: gastosData } = await supabase
        .from("gastos")
        .select("cerdo_id, monto")
        .in("cerdo_id", todosLosCerdos)

      ;(gastosData || []).forEach((g) => {
        gastosMap[g.cerdo_id] = (gastosMap[g.cerdo_id] || 0) + Number(g.monto || 0)
      })
    }

    // Agrupar ventas normales
    const ventasAgrupadasArr = (ventasNormalesFiltradas || []).map((venta) => {
      const detalle = venta.detalle_venta?.[0]
      const cerdo = detalle?.cerdos
      const gastos = gastosMap[detalle?.cerdo_id] || 0
      const pagosOrdenados = (venta.pagos || []).sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      const totalPagado = sumarPagos(pagosOrdenados)
      const deuda = Math.max(0, Number(venta.total || 0) - totalPagado)

      return {
        ventaId: venta.id,
        fecha: venta.fecha,
        tipo: "normal", // pie o canal
        cerdo: cerdo,
        gastos: gastos,
        totalVenta: Number(venta.total || 0),
        clientes: [
          {
            clienteId: venta.clientes?.id,
            nombre: venta.clientes?.nombre,
            subtotal: Number(venta.total || 0),
            abonos: pagosOrdenados,
            totalPagado: totalPagado,
            deuda: deuda,
            esLibriado: false
          }
        ]
      }
    })

    // Agrupar ventas libriado
    const ventasLibriadoArr = []
    
    for (const venta of ventasLibriadoConFiados || []) {
      const detalle = venta.detalle_venta?.[0]
      const cerdo = detalle?.cerdos
      const gastos = gastosMap[detalle?.cerdo_id] || 0

      const clientes = (venta.ventas_libriado || [])
        .filter((lib) => lib.estado === "fiado")
        .map(async (lib) => {
          // Obtener SOLO los abonos de ESTE cliente específico
          const { data: abonos } = await supabase
            .from("pagos")
            .select("id, monto, fecha, metodo")
            .eq("ventas_libriado_id", lib.id)
            .order("fecha", { ascending: true })
          
          const subtotal = Number(lib.subtotal || 0)
          const totalPagado = sumarPagos(abonos || [])
          const deuda = Math.max(0, subtotal - totalPagado)

          return {
            clienteId: lib.clientes?.id,
            nombre: lib.clientes?.nombre,
            subtotal: subtotal,
            kilos: lib.kilos,
            precioKilo: lib.precio_kilo,
            abonos: abonos || [], // Abonos solo de este cliente
            totalPagado: totalPagado,
            deuda: deuda,
            libriado_id: lib.id,
            esLibriado: true
          }
        })

      // Esperar a que se resuelvan todos los clientes
      const clientesResueltos = await Promise.all(clientes)

      ventasLibriadoArr.push({
        ventaId: venta.id,
        fecha: venta.fecha,
        tipo: "libriado",
        cerdo: cerdo,
        gastos: gastos,
        totalVenta: Number(venta.total || 0),
        clientes: clientesResueltos
      })
    }

    setVentasAgrupadas([...ventasAgrupadasArr, ...ventasLibriadoArr])
  }

  const registrarAbono = async (ventaId, clienteData) => {
    if (!canEdit) return toast.error("No tienes permisos para editar información")
    const abonoKey = `${ventaId}-${clienteData.clienteId}`
    const abono = abonosActivos[abonoKey]
    
    if (!abono || !abono.monto) return toast.error("Ingrese monto del abono")
    if (parseNumber(abono.monto) <= 0) return toast.error("El monto del abono debe ser mayor a 0")

    // Preparar datos del pago
    const pagoPrepare = {
      venta_id: ventaId,
      monto: parseNumber(abono.monto),
      fecha: new Date().toISOString().split("T")[0],
      metodo: abono.metodo || "Efectivo",
      usuario_id: user?.id || null
    }

    // Si es libriado, agregar el ventas_libriado_id
    if (clienteData.esLibriado) {
      pagoPrepare.ventas_libriado_id = clienteData.libriado_id
    }

    // Registrar el pago
    const { error } = await supabase.from("pagos").insert([pagoPrepare])

    if (error) return toast.error(error.message)

    if (clienteData.esLibriado) {
      // Para libriados: calcular cuánto ha pagado y actualizar estado si es necesario
      const nuevoPagado = clienteData.totalPagado + parseNumber(abono.monto)
      
      if (nuevoPagado >= clienteData.subtotal) {
        // Si ya pagó todo, marcar como pagado
        await supabase.from("ventas_libriado").update({ estado: "pagado" }).eq("id", clienteData.libriado_id)
      }
    } else {
      // Para ventas normales: actualizar estado de la venta
      const totalPagado = clienteData.totalPagado + parseNumber(abono.monto)
      const estado = totalPagado >= clienteData.subtotal ? "pagada" : "parcial"
      await supabase.from("ventas").update({ estado }).eq("id", ventaId)
    }

    await registrarAuditoria({
      usuarioId: user?.id || null,
      modulo: "fiados",
      accion: "abono",
      entidad: clienteData.esLibriado ? "ventas_libriado" : "ventas",
      entidadId: String(clienteData.esLibriado ? clienteData.libriado_id : ventaId),
      descripcion: `Registró abono a ${clienteData.nombre}`,
      metadata: {
        ventaId,
        clienteId: clienteData.clienteId,
        monto: parseNumber(abono.monto),
        metodo: abono.metodo || "Efectivo"
      }
    })

    // Limpiar abono y recargar
    setAbonosActivos((prev) => {
      const nuevo = { ...prev }
      delete nuevo[abonoKey]
      return nuevo
    })
    cargarDatos()
  }

  const marcarPagado = async (ventaId, clienteData) => {
    if (!canEdit) return toast.error("No tienes permisos para editar información")
    if (clienteData.esLibriado) {
      // Para libriados: registrar pago de la deuda pendiente y marcar como pagado
      const { error } = await supabase.from("pagos").insert([
        {
          venta_id: ventaId,
          ventas_libriado_id: clienteData.libriado_id,
          monto: Number(clienteData.deuda),
          fecha: new Date().toISOString().split("T")[0],
          metodo: "Efectivo",
          usuario_id: user?.id || null
        }
      ])

      if (error) return toast.error(error.message)

      await supabase.from("ventas_libriado").update({ estado: "pagado" }).eq("id", clienteData.libriado_id)
    } else {
      // Para ventas normales
      const deuda = clienteData.deuda

      if (deuda > 0) {
        await supabase.from("pagos").insert([
          {
            venta_id: ventaId,
            monto: deuda,
            fecha: new Date().toISOString().split("T")[0],
            metodo: "Efectivo",
            usuario_id: user?.id || null
          }
        ])
      }

      await supabase.from("ventas").update({ estado: "pagada" }).eq("id", ventaId)
    }

    await registrarAuditoria({
      usuarioId: user?.id || null,
      modulo: "fiados",
      accion: "pagar_todo",
      entidad: clienteData.esLibriado ? "ventas_libriado" : "ventas",
      entidadId: String(clienteData.esLibriado ? clienteData.libriado_id : ventaId),
      descripcion: `Marcó deuda como pagada para ${clienteData.nombre}`,
      metadata: {
        ventaId,
        clienteId: clienteData.clienteId,
        deuda: Number(clienteData.deuda || 0)
      }
    })

    cargarDatos()
  }

  const toggleAbono = (ventaId, clienteId) => {
    const key = `${ventaId}-${clienteId}`
    setAbonosActivos((prev) => {
      if (prev[key]) {
        const nuevo = { ...prev }
        delete nuevo[key]
        return nuevo
      } else {
        return { ...prev, [key]: { monto: "", metodo: "Efectivo" } }
      }
    })
  }

  const actualizarAbono = (ventaId, clienteId, campo, valor) => {
    const key = `${ventaId}-${clienteId}`
    setAbonosActivos((prev) => ({
      ...prev,
      [key]: { ...prev[key], [campo]: valor }
    }))
  }

  const verHistorial = async (venta, cliente) => {
    // Obtener pagos específicos del cliente
    let pagosQuery = supabase
      .from("pagos")
      .select("id, monto, fecha, metodo")
      .order("fecha", { ascending: true })

    // Si es libriado: filtrar por ventas_libriado_id
    if (cliente.esLibriado) {
      pagosQuery = pagosQuery.eq("ventas_libriado_id", cliente.libriado_id)
    } else {
      // Si es normal: filtrar por venta_id (es el único cliente)
      pagosQuery = pagosQuery.eq("venta_id", venta.ventaId)
    }

    const { data: pagos } = await pagosQuery

    // Construir historial con saldo acumulativo
    let saldoPendiente = cliente.subtotal
    const historial = (pagos || []).map((pago) => {
      const montoAbonado = Number(pago.monto || 0)
      const quedoDebiendo = Math.max(0, saldoPendiente - montoAbonado)
      const resultado = {
        fecha: pago.fecha,
        monto: montoAbonado,
        metodo: pago.metodo,
        quedoDebiendo: quedoDebiendo,
        saldoAnterior: saldoPendiente
      }
      saldoPendiente = quedoDebiendo
      return resultado
    })

    setHistorialActivo({
      cliente: cliente,
      venta: venta,
      historial: historial
    })
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Fiados</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      {cargando ? (
        <div className="bg-white shadow rounded p-8 text-center">
          <p className="text-gray-600">Cargando información...</p>
        </div>
      ) : ventasAgrupadas.length === 0 ? (
        <div className="bg-white shadow rounded p-8 text-center text-gray-500">
          <p className="text-lg mb-2">No hay ventas fiadas</p>
          <p className="text-sm">Las ventas con estado "pendiente" o "parcial" aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-6">
          {ventasAgrupadas.map((venta) => {
            const costoCompra = Number(venta.cerdo?.costo_compra || 0)
            const totalKilosCarne = venta.tipo === "libriado" 
              ? venta.clientes.reduce((sum, c) => sum + Number(c.kilos || 0), 0)
              : 0
            const ganancia = venta.totalVenta - costoCompra - venta.gastos

            // Mostrar columnas de abonos para ambos tipos
            const maxAbonos = Math.max(...venta.clientes.map(c => c.abonos.length), 0)
            const columnasAbonos = Math.max(maxAbonos + 1, 4) // Mostrar mínimo 4 columnas

            return (
              <div key={venta.ventaId} className="bg-white shadow rounded overflow-hidden">
                {/* Encabezado con información del cerdo */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
                  <div className="flex flex-wrap gap-6 items-center">
                    <div>
                      <span className="text-sm opacity-90">Venta #{venta.ventaId}</span>
                      <h3 className="text-xl font-bold">
                        Cerdo #{venta.cerdo?.id}
                        {venta.cerdo?.codigo ? ` (${venta.cerdo.codigo})` : ""}
                        {venta.cerdo?.observaciones ? ` - ${venta.cerdo.observaciones}` : ""}
                      </h3>
                    </div>
                    <div className="flex-1 flex flex-wrap gap-4 text-sm">
                      <div>
                        <span className="opacity-90">Peso en pie:</span>
                        <span className="font-bold ml-1">{venta.cerdo?.peso || 0} lb</span>
                      </div>
                      {venta.tipo === "libriado" && (
                        <div>
                          <span className="opacity-90">Kilos de carne:</span>
                          <span className="font-bold ml-1">{totalKilosCarne} kg</span>
                        </div>
                      )}
                      <div>
                        <span className="opacity-90">Costo compra:</span>
                        <span className="font-bold ml-1">${costoCompra.toLocaleString('es-CO')}</span>
                      </div>
                      <div>
                        <span className="opacity-90">Gastos:</span>
                        <span className="font-bold ml-1">${Number(venta.gastos).toLocaleString('es-CO')}</span>
                      </div>
                      <div>
                        <span className="opacity-90">Total venta:</span>
                        <span className="font-bold ml-1">${Number(venta.totalVenta).toLocaleString('es-CO')}</span>
                      </div>
                      <div className="bg-white bg-opacity-20 px-3 py-1 rounded">
                        <span className="opacity-90">{ganancia >= 0 ? "Ganancia:" : "Pérdida:"}</span>
                        <span className={`font-bold ml-1 ${ganancia >= 0 ? "text-green-300" : "text-red-300"}`}>
                          ${Math.abs(ganancia).toLocaleString('es-CO')}
                        </span>
                        <span className="text-xs opacity-75 ml-2">
                          (${venta.totalVenta.toLocaleString('es-CO')} - ${costoCompra.toLocaleString('es-CO')} - ${Number(venta.gastos).toLocaleString('es-CO')})
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm opacity-90">{venta.fecha}</span>
                      <div className="font-medium">
                        {venta.tipo === "libriado" ? "Libriado" : "Pie/Canal"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabla de clientes */}
                <div className="p-4 overflow-x-auto">
                  <h4 className="font-semibold mb-3 text-gray-700">Clientes que deben:</h4>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Cliente</th>
                        {venta.tipo === "libriado" && (
                          <>
                            <th className="text-left py-2">Kilos</th>
                            <th className="text-left py-2">Precio/Kilo</th>
                          </>
                        )}
                        <th className="text-left py-2">Total</th>
                        {[...Array(columnasAbonos)].map((_, i) => (
                          <th key={i} className="text-left py-2 text-green-700">Abono {i + 1}</th>
                        ))}
                        <th className="text-left py-2 font-bold text-red-700">Deuda</th>
                        <th className="text-left py-2">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {venta.clientes.map((cliente) => {
                        const abonoKey = `${venta.ventaId}-${cliente.clienteId}`
                        const abonoActivo = abonosActivos[abonoKey]

                        return (
                          <>
                            <tr key={abonoKey} className="border-t">
                              <td className="py-2">{cliente.nombre}</td>
                              {venta.tipo === "libriado" && (
                                <>
                                  <td>{cliente.kilos} kg</td>
                                  <td>${Number(cliente.precioKilo).toLocaleString('es-CO')}</td>
                                </>
                              )}
                              <td>${Number(cliente.subtotal).toLocaleString('es-CO')}</td>
                              {[...Array(columnasAbonos)].map((_, i) => (
                                <td key={i} className="text-green-600">
                                  {cliente.abonos[i] ? `$${Number(cliente.abonos[i].monto).toLocaleString('es-CO')}` : ''}
                                </td>
                              ))}
                              <td className="font-bold text-red-600">${Number(cliente.deuda).toLocaleString('es-CO')}</td>
                              <td>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => toggleAbono(venta.ventaId, cliente.clienteId)}
                                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                                  >
                                    {abonoActivo ? "Cancelar" : "Abonar"}
                                  </button>
                                  <button
                                    onClick={() => marcarPagado(venta.ventaId, cliente)}
                                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                                  >
                                    Pagar todo
                                  </button>
                                  <button
                                    onClick={() => verHistorial(venta, cliente)}
                                    className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
                                  >
                                    Historial
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {abonoActivo && (
                              <tr key={`${abonoKey}-form`} className="bg-blue-50">
                                <td colSpan={venta.tipo === "libriado" ? 5 + columnasAbonos : 3 + columnasAbonos} className="py-3 px-4">
                                  <div className="flex gap-3 items-center">
                                    <span className="font-medium text-sm">Registrar abono:</span>
                                    <input
                                      type="text"
                                      placeholder="Monto"
                                      value={abonoActivo.monto}
                                      onChange={(e) => actualizarAbono(venta.ventaId, cliente.clienteId, "monto", formatNumber(e.target.value))}
                                      className="border p-2 rounded w-32"
                                    />
                                    <select
                                      value={abonoActivo.metodo}
                                      onChange={(e) => actualizarAbono(venta.ventaId, cliente.clienteId, "metodo", e.target.value)}
                                      className="border p-2 rounded"
                                    >
                                      <option>Efectivo</option>
                                      <option>Tarjeta</option>
                                      <option>Transferencia</option>
                                    </select>
                                    <button
                                      onClick={() => registrarAbono(venta.ventaId, cliente)}
                                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                                    >
                                      Guardar abono
                                    </button>
                                    <span className="text-sm text-gray-600">
                                      Quedará debiendo: ${Math.max(0, cliente.deuda - parseNumber(abonoActivo.monto || 0)).toLocaleString('es-CO')}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Historial de Pagos */}
      {historialActivo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Historial de Pagos</h2>
                  <p className="text-lg mb-1">{historialActivo.cliente.nombre}</p>
                  <div className="text-sm space-y-1 opacity-90">
                    <p>
                      Venta #{historialActivo.venta.ventaId} - Cerdo #{historialActivo.venta.cerdo?.id}
                      {historialActivo.venta.cerdo?.codigo ? ` (${historialActivo.venta.cerdo.codigo})` : ""}
                      {historialActivo.venta.cerdo?.observaciones ? ` - ${historialActivo.venta.cerdo.observaciones}` : ""}
                    </p>
                    {historialActivo.venta.tipo === "libriado" && (
                      <p>
                        {historialActivo.cliente.kilos} kg × ${Number(historialActivo.cliente.precioKilo).toLocaleString('es-CO')} 
                        = ${Number(historialActivo.cliente.subtotal).toLocaleString('es-CO')}
                      </p>
                    )}
                    <p className="font-bold text-lg mt-2">
                      Deuda actual: ${Number(historialActivo.cliente.deuda).toLocaleString('es-CO')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setHistorialActivo(null)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              {historialActivo.historial.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No hay pagos registrados aún</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historialActivo.historial.map((pago, index) => (
                    <div key={index} className="border-l-4 border-blue-500 bg-gray-50 p-4 rounded">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm text-gray-600">
                            {new Date(pago.fecha).toLocaleDateString('es-CO', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">Método: {pago.metodo}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Abonó</p>
                          <p className="text-xl font-bold text-green-600">
                            ${pago.monto.toLocaleString('es-CO')}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                        <div>
                          <p className="text-xs text-gray-500">Deuda anterior</p>
                          <p className="font-semibold">${pago.saldoAnterior.toLocaleString('es-CO')}</p>
                        </div>
                        <div className="text-gray-400">→</div>
                        <div>
                          <p className="text-xs text-gray-500">Quedó debiendo</p>
                          <p className="font-semibold text-red-600">${pago.quedoDebiendo.toLocaleString('es-CO')}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 pt-4 border-t-2 border-gray-300">
                <div className="flex justify-between items-center text-lg">
                  <span className="font-semibold">Total del cerdo:</span>
                  <span className="font-bold">${Number(historialActivo.cliente.subtotal).toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between items-center text-lg mt-2">
                  <span className="font-semibold">Total pagado:</span>
                  <span className="font-bold text-green-600">
                    ${Number(historialActivo.cliente.totalPagado).toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xl mt-2 pt-2 border-t">
                  <span className="font-bold">Deuda pendiente:</span>
                  <span className="font-bold text-red-600">
                    ${Number(historialActivo.cliente.deuda).toLocaleString('es-CO')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
