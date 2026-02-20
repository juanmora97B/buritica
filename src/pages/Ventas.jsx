import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import toast from "react-hot-toast"
import { supabase } from "../lib/supabase"

const sumarPagos = (pagos) => {
  return pagos.reduce((acc, p) => acc + Number(p.monto || 0), 0)
}

const obtenerUltimoPago = (pagos) => {
  if (!pagos.length) return null
  return pagos.slice().sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0]
}

export default function Ventas() {
  const navigate = useNavigate()
  const [ventas, setVentas] = useState([])
  const [gastosMap, setGastosMap] = useState({})

  async function fetchVentas() {
    const { data, error } = await supabase
      .from("ventas")
      .select(
        "id, fecha, total, estado, tipo_venta, observaciones, clientes(nombre), detalle_venta(id, cerdo_id, cantidad, precio_unitario, subtotal, cerdos(estado, costo_compra, observaciones, codigo, peso)), pagos(id, monto, fecha, metodo), ventas_libriado(id, cliente_id, kilos, precio_kilo, subtotal, estado, clientes(nombre))"
      )
      .order("created_at", { ascending: false })

    if (error) {
      toast.error("Error al cargar ventas: " + error.message)
      return
    }

    setVentas(data || [])

    const cerdoIds = Array.from(
      new Set(
        (data || [])
          .flatMap((venta) => venta.detalle_venta || [])
          .map((detalle) => detalle.cerdo_id)
          .filter(Boolean)
      )
    )

    if (cerdoIds.length) {
      const { data: gastosData } = await supabase
        .from("gastos")
        .select("cerdo_id, monto")
        .in("cerdo_id", cerdoIds)

      const map = {}
      ;(gastosData || []).forEach((g) => {
        map[g.cerdo_id] = (map[g.cerdo_id] || 0) + Number(g.monto || 0)
      })
      setGastosMap(map)
    } else {
      setGastosMap({})
    }
  }

  useEffect(() => {
    fetchVentas()
  }, [])

  const eliminarVenta = async (id) => {
    const confirmar = window.confirm("¿Eliminar venta?")
    if (!confirmar) return

    await supabase.from("detalle_venta").delete().eq("venta_id", id)
    await supabase.from("pagos").delete().eq("venta_id", id)

    const { error } = await supabase.from("ventas").delete().eq("id", id)
    if (error) {
      toast.error(error.message)
      return
    }

    setVentas(ventas.filter((v) => v.id !== id))
  }

  const editarVenta = (ventaId) => {
    navigate("/ventas/nueva", { state: { ventaId } })
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Ventas</h1>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => navigate("/ventas/nueva")}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Nueva Venta
        </button>
      </div>

      {ventas.length === 0 && (
        <div className="bg-gray-100 border border-gray-300 rounded p-4 text-center text-gray-600">
          No hay ventas registradas. Haz clic en "Nueva Venta" para agregar una.
        </div>
      )}

      {ventas.map((venta) => {
        const productos = venta.detalle_venta || []
        const libros = venta.ventas_libriado || []
        const pagos = venta.pagos || []
        const totalPagado = sumarPagos(pagos)
        const ultimoPago = obtenerUltimoPago(pagos)
        const cambio = Math.max(0, totalPagado - Number(venta.total || 0))

        const cerdoDetalle = productos.find((p) => p.cerdo_id)
        const cerdoId = cerdoDetalle?.cerdo_id
        const cerdoEstado = cerdoDetalle?.cerdos?.estado
        const costoCompra = Number(cerdoDetalle?.cerdos?.costo_compra || 0)
        const cerdoObs = cerdoDetalle?.cerdos?.observaciones || ""
        const cerdoCodigo = cerdoDetalle?.cerdos?.codigo || ""
        const gastos = Number(gastosMap[cerdoId] || 0)
        const utilidad = Number(venta.total || 0) - costoCompra - gastos

        const tipoVenta = venta.tipo_venta || (cerdoEstado === "vendido_pie"
          ? "pie"
          : cerdoEstado === "vendido_canal"
            ? "canal"
            : cerdoEstado === "vendido_kilo"
              ? "libriado"
              : "")

        const tipoVentaLabel = tipoVenta === "pie"
          ? "Pie"
          : tipoVenta === "canal"
            ? "Canal"
            : tipoVenta === "libriado"
              ? "Libriado"
              : "-"

        const deuda = Math.max(0, Number(venta.total || 0) - totalPagado)

        return (
          <div key={venta.id} className="bg-white shadow rounded p-4 mb-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-xl font-bold">Venta #{venta.id}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => editarVenta(venta.id)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                >
                  Editar
                </button>
                <button
                  onClick={() => eliminarVenta(venta.id)}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                >
                  Eliminar
                </button>
              </div>
            </div>

            <p className="mb-3">
              {venta.clientes?.nombre} — {venta.fecha} — Estado: {venta.estado} — Tipo: {tipoVentaLabel}
              {cerdoId && (cerdoObs || cerdoCodigo) && (
                <span className="font-semibold text-green-700">
                  {" "} — Cerdo: {cerdoObs || `#${cerdoId}`}
                  {cerdoCodigo && ` (${cerdoCodigo})`}
                </span>
              )}
            </p>

            {libros.length > 0 ? (
                <table className="w-full border-collapse border mb-3">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left">Cliente</th>
                      <th className="border p-2 text-left">Kilos</th>
                      <th className="border p-2 text-left">Precio kilo</th>
                      <th className="border p-2 text-left">Subtotal</th>
                      <th className="border p-2 text-left">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {libros.map((fila) => (
                      <tr key={fila.id}>
                        <td className="border p-2">{fila.clientes?.nombre}</td>
                        <td className="border p-2">{fila.kilos}</td>
                        <td className="border p-2">${Number(fila.precio_kilo).toLocaleString('es-CO')}</td>
                        <td className="border p-2">${Number(fila.subtotal).toLocaleString('es-CO')}</td>
                        <td className="border p-2">{fila.estado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : productos.length > 0 ? (
                <table className="w-full border-collapse border mb-3">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left">Producto</th>
                      <th className="border p-2 text-left">Cantidad</th>
                      <th className="border p-2 text-left">Precio</th>
                      <th className="border p-2 text-left">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productos.map((prod) => (
                      <tr key={prod.id}>
                        <td className="border p-2">Cerdo</td>
                        <td className="border p-2">{prod.cantidad}</td>
                        <td className="border p-2">${Number(prod.precio_unitario).toLocaleString('es-CO')}</td>
                        <td className="border p-2">${Number(prod.subtotal).toLocaleString('es-CO')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}

            <div className="font-bold mb-3">Total: ${Number(venta.total).toLocaleString('es-CO')}</div>

            <div className="border p-3 mb-2">
              Metodo: {ultimoPago?.metodo || "Sin pago"} — Pagado: ${totalPagado.toLocaleString('es-CO')} — Deuda: ${deuda.toLocaleString('es-CO')} — Cambio: ${cambio.toLocaleString('es-CO')}
            </div>

            {cerdoId && (
              <div className="border p-3">
                Costo compra: ${costoCompra.toLocaleString('es-CO')} — Gastos asociados: ${gastos.toLocaleString('es-CO')} — Utilidad estimada: ${utilidad.toLocaleString('es-CO')}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
