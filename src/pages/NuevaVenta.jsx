import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import toast from "react-hot-toast"
import { supabase } from "../lib/supabase"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { canEditByRole } from "../lib/permissions"
import { formatNumber, parseNumber } from "../utils/formatNumber"

const TIPOS_VENTA = ["pie", "canal", "libriado"]

const calcularEstadoVenta = (total, pagado, formaPago) => {
  const totalNum = parseNumber(total || 0)
  const pagadoNum = parseNumber(pagado || 0)

  if (formaPago === "fiado" && pagadoNum <= 0) return "pendiente"
  if (pagadoNum >= totalNum && totalNum > 0) return "pagada"
  if (pagadoNum > 0) return "parcial"
  return "pendiente"
}

export default function NuevaVenta() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, userProfile } = useCurrentUser()
  const canEdit = canEditByRole(userProfile?.rol)
  const preselectedCerdoId = location.state?.cerdoId || ""
  const preselectedTipoVenta = location.state?.tipoVenta || ""
  const ventaId = location.state?.ventaId || null

  const [cerdos, setCerdos] = useState([])
  const [clientes, setClientes] = useState([])

  const [cerdoId, setCerdoId] = useState(preselectedCerdoId)
  const [tipoVenta, setTipoVenta] = useState(preselectedTipoVenta || "pie")
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0])
  const [observaciones] = useState("")

  const [pesoVenta, setPesoVenta] = useState("")
  const [precioKilo, setPrecioKilo] = useState("")
  const [clienteId, setClienteId] = useState("")
  const [formaPago, setFormaPago] = useState("contado")
  const [montoPagado, setMontoPagado] = useState("")

  const [clienteLibriadoId, setClienteLibriadoId] = useState("")
  const [pesoCanalDisponible, setPesoCanalDisponible] = useState("")
  const [filasLibriado, setFilasLibriado] = useState([])

  const [gastosCerdo, setGastosCerdo] = useState(0)
  const [saving, setSaving] = useState(false)
  const [, setLoadingVenta] = useState(false)

  useEffect(() => {
    fetchInicial()
  }, [])

  useEffect(() => {
    if (ventaId) {
      cargarVenta(ventaId)
    }
  }, [ventaId])

  useEffect(() => {
    if (!cerdoId) {
      setPesoVenta("")
      setPesoCanalDisponible("")
      setGastosCerdo(0)
      return
    }

    const cerdo = cerdos.find((c) => String(c.id) === String(cerdoId))
    if (cerdo) {
      setPesoVenta(String(cerdo.peso || ""))
      setPesoCanalDisponible(String(cerdo.peso || ""))
      fetchGastosCerdo(cerdo.id)
    }
  }, [cerdoId, cerdos])

  const fetchInicial = async () => {
    const [{ data: cerdosData }, { data: clientesData }] = await Promise.all([
      supabase
        .from("cerdos")
        .select("id, peso, estado, costo_compra")
        .eq("estado", "vivo")
        .order("id"),
      supabase.from("clientes").select("id, nombre").order("nombre")
    ])

    setCerdos(cerdosData || [])
    setClientes(clientesData || [])
  }

  const fetchGastosCerdo = async (id) => {
    const { data } = await supabase
      .from("gastos")
      .select("monto")
      .eq("cerdo_id", id)

    const totalGastos = (data || []).reduce((acc, g) => acc + Number(g.monto || 0), 0)
    setGastosCerdo(totalGastos)
  }

  const cargarVenta = async (id) => {
    setLoadingVenta(true)
    const { data, error } = await supabase
      .from("ventas")
      .select(
        "id, cliente_id, fecha, total, estado, detalle_venta(id, cerdo_id, cantidad, precio_unitario, subtotal, cerdos(estado, peso)), pagos(id, monto, fecha, metodo), ventas_libriado(id, cliente_id, kilos, precio_kilo, subtotal, observacion, estado, clientes(nombre))"
      )
      .eq("id", id)
      .single()

    if (error) {
      toast.error(error.message)
      setLoadingVenta(false)
      return
    }

    const detalle = (data.detalle_venta || [])[0]
    if (detalle?.cerdo_id) {
      setCerdoId(String(detalle.cerdo_id))
      const cerdoEstado = detalle.cerdos?.estado
      if (cerdoEstado === "vendido_pie") setTipoVenta("pie")
      else if (cerdoEstado === "vendido_canal") setTipoVenta("canal")
      else if (cerdoEstado === "vendido_kilo") setTipoVenta("libriado")
    }

    setFecha(data.fecha || new Date().toISOString().split("T")[0])

    if (data.ventas_libriado && data.ventas_libriado.length) {
      setTipoVenta("libriado")
      setFilasLibriado(
        data.ventas_libriado.map((fila) => ({
          id: fila.id,
          cliente_id: fila.cliente_id,
          cliente_nombre: fila.clientes?.nombre || "",
          kilos: String(fila.kilos || ""),
          precio_kilo: String(fila.precio_kilo || ""),
          subtotal: Number(fila.subtotal || 0),
          observacion: fila.observacion || "",
          estado: fila.estado || "pagado"
        }))
      )
    } else {
      setClienteId(String(data.cliente_id || ""))
      if (detalle) {
        setPesoVenta(String(detalle.cantidad || ""))
        setPrecioKilo(String(detalle.precio_unitario || ""))
      }
    }

    const totalPagado = (data.pagos || []).reduce((acc, p) => acc + Number(p.monto || 0), 0)
    setMontoPagado(totalPagado ? String(totalPagado) : "")
    setFormaPago(totalPagado > 0 ? "contado" : "fiado")
    setLoadingVenta(false)
  }

  const cerdoSeleccionado = useMemo(
    () => cerdos.find((c) => String(c.id) === String(cerdoId)),
    [cerdoId, cerdos]
  )

  const totalDirecto = useMemo(
    () => parseNumber(pesoVenta || 0) * parseNumber(precioKilo || 0),
    [pesoVenta, precioKilo]
  )

  const cambioDirecto = useMemo(
    () => Math.max(0, parseNumber(montoPagado || 0) - totalDirecto),
    [montoPagado, totalDirecto]
  )

  const totalLibriado = useMemo(
    () => filasLibriado.reduce((acc, fila) => acc + Number(fila.subtotal || 0), 0),
    [filasLibriado]
  )

  const kilosVendidosLibriado = useMemo(
    () => filasLibriado.reduce((acc, fila) => acc + parseNumber(fila.kilos || 0), 0),
    [filasLibriado]
  )

  const gananciaEstimada = useMemo(() => {
    const ingreso = tipoVenta === "libriado" ? totalLibriado : totalDirecto
    const costoCompra = Number(cerdoSeleccionado?.costo_compra || 0)
    return ingreso - costoCompra - Number(gastosCerdo || 0)
  }, [tipoVenta, totalLibriado, totalDirecto, cerdoSeleccionado, gastosCerdo])

  const agregarFilaLibriado = () => {
    if (!clienteLibriadoId) return

    const cliente = clientes.find((c) => String(c.id) === String(clienteLibriadoId))
    if (!cliente) return

    setFilasLibriado((prev) => [
      ...prev,
      {
        id: Date.now(),
        cliente_id: cliente.id,
        cliente_nombre: cliente.nombre,
        kilos: "",
        precio_kilo: "",
        subtotal: 0,
        observacion: "",
        estado: "pagado"
      }
    ])
    setClienteLibriadoId("")
  }

  const actualizarFilaLibriado = (id, campo, valor) => {
    setFilasLibriado((prev) =>
      prev.map((fila) => {
        if (fila.id !== id) return fila
        const actualizada = { ...fila, [campo]: valor }
        const subtotal = parseNumber(actualizada.kilos || 0) * parseNumber(actualizada.precio_kilo || 0)
        return { ...actualizada, subtotal }
      })
    )
  }

  const quitarFilaLibriado = (id) => {
    setFilasLibriado((prev) => prev.filter((fila) => fila.id !== id))
  }

  const guardarVenta = async () => {
    if (!canEdit) return toast.error("No tienes permisos para editar información")
    if (saving) return
    if (!cerdoId) return toast.error("Seleccione un cerdo")

    setSaving(true)

    try {
      if (tipoVenta === "pie" || tipoVenta === "canal") {
        if (!clienteId) {
          toast.error("Seleccione cliente")
          return
        }

        if (!pesoVenta || !precioKilo) {
          toast.error("Ingrese peso y precio por kilo")
          return
        }

        if (parseNumber(pesoVenta) <= 0 || parseNumber(precioKilo) <= 0) {
          toast.error("Peso y precio deben ser mayores a 0")
          return
        }

        if (cerdoSeleccionado?.peso && parseNumber(pesoVenta) > Number(cerdoSeleccionado.peso)) {
          toast.error("El peso de venta no puede superar el peso del cerdo")
          return
        }

        const estadoVenta = calcularEstadoVenta(totalDirecto, parseNumber(montoPagado), formaPago)

        let nuevaVentaId = ventaId

        if (ventaId) {
          const { error: ventaError } = await supabase
            .from("ventas")
            .update({
              cliente_id: Number(clienteId),
              fecha,
              total: totalDirecto,
              estado: estadoVenta
            })
            .eq("id", ventaId)

          if (ventaError) throw ventaError
        } else {
          const { data: ventaCreada, error: ventaError } = await supabase
            .from("ventas")
            .insert([
              {
                cliente_id: Number(clienteId),
                fecha,
                total: totalDirecto,
                estado: estadoVenta,
                tipo_venta: tipoVenta,
                observaciones: observaciones || null,
                usuario_id: user?.id || null
              }
            ])
            .select("id")
            .single()

          if (ventaError) throw ventaError
          nuevaVentaId = ventaCreada.id
        }

        if (ventaId) {
          await supabase.from("detalle_venta").delete().eq("venta_id", ventaId)
          await supabase.from("pagos").delete().eq("venta_id", ventaId)
          await supabase.from("ventas_libriado").delete().eq("venta_id", ventaId)
        }
        const { error: detalleError } = await supabase.from("detalle_venta").insert([
          {
            venta_id: nuevaVentaId,
            cerdo_id: Number(cerdoId),
            cantidad: parseNumber(pesoVenta),
            precio_unitario: parseNumber(precioKilo),
            subtotal: totalDirecto
          }
        ])
        if (detalleError) throw detalleError

        if (parseNumber(montoPagado || 0) > 0) {
          const { error: pagoError } = await supabase.from("pagos").insert([
            {
              venta_id: nuevaVentaId,
              monto: parseNumber(montoPagado),
              fecha,
              metodo: formaPago === "contado" ? "Efectivo" : "Fiado",
              usuario_id: user?.id || null
            }
          ])
          if (pagoError) throw pagoError
        }

        const nuevoEstadoCerdo = tipoVenta === "pie" ? "vendido_pie" : "vendido_canal"
        const { error: cerdoError } = await supabase
          .from("cerdos")
          .update({ estado: nuevoEstadoCerdo })
          .eq("id", Number(cerdoId))
        if (cerdoError) throw cerdoError

        await supabase.from("movimientos_cerdos").insert([
          {
            cerdo_id: Number(cerdoId),
            tipo: "venta",
            descripcion: `Venta ${tipoVenta} - Venta #${nuevaVentaId}`,
            fecha
          }
        ])
      }

      if (tipoVenta === "libriado") {
        if (!filasLibriado.length) {
          toast.error("Agregue clientes en la tabla")
          return
        }

        if (!pesoCanalDisponible) {
          toast.error("Ingrese peso canal disponible")
          return
        }

        if (kilosVendidosLibriado > parseNumber(pesoCanalDisponible)) {
          toast.error("Error: no puede vender más kilos que el peso disponible")
          return
        }

        if (filasLibriado.some((f) => parseNumber(f.kilos || 0) <= 0 || parseNumber(f.precio_kilo || 0) <= 0)) {
          toast.error("Cada fila debe tener kilos y precio mayores a 0")
          return
        }

        const pagados = filasLibriado
          .filter((f) => f.estado === "pagado")
          .reduce((acc, f) => acc + Number(f.subtotal || 0), 0)

        const estadoVenta = calcularEstadoVenta(totalLibriado, pagados, pagados > 0 ? "contado" : "fiado")

        let nuevaVentaId = ventaId

        if (ventaId) {
          const { error: ventaError } = await supabase
            .from("ventas")
            .update({
              cliente_id: Number(filasLibriado[0].cliente_id),
              fecha,
              total: totalLibriado,
              estado: estadoVenta
            })
            .eq("id", ventaId)

          if (ventaError) throw ventaError
        } else {
          const { data: ventaCreada, error: ventaError } = await supabase
            .from("ventas")
            .insert([
              {
                cliente_id: Number(filasLibriado[0].cliente_id),
                fecha,
                total: totalLibriado,
                estado: estadoVenta,
                tipo_venta: tipoVenta,
                observaciones: observaciones || null,
                usuario_id: user?.id || null
              }
            ])
            .select("id")
            .single()

          if (ventaError) throw ventaError
          nuevaVentaId = ventaCreada.id
        }

        if (ventaId) {
          await supabase.from("detalle_venta").delete().eq("venta_id", ventaId)
          await supabase.from("pagos").delete().eq("venta_id", ventaId)
          await supabase.from("ventas_libriado").delete().eq("venta_id", ventaId)
        }
        const payloadLibriado = filasLibriado.map((fila) => ({
          venta_id: nuevaVentaId,
          cliente_id: fila.cliente_id,
          kilos: parseNumber(fila.kilos || 0),
          precio_kilo: parseNumber(fila.precio_kilo || 0),
          subtotal: parseNumber(fila.subtotal || 0),
          observacion: fila.observacion || null,
          estado: fila.estado
        }))

        const { error: libriadoError } = await supabase.from("ventas_libriado").insert(payloadLibriado)
        if (libriadoError) throw libriadoError

        const pagosPayload = filasLibriado
          .filter((fila) => fila.estado === "pagado")
          .map((fila) => ({
            venta_id: nuevaVentaId,
            monto: Number(fila.subtotal || 0),
            fecha,
            metodo: "Efectivo",
            usuario_id: user?.id || null
          }))

        if (pagosPayload.length) {
          const { error: pagoError } = await supabase.from("pagos").insert(pagosPayload)
          if (pagoError) throw pagoError
        }

        const { error: detalleError } = await supabase.from("detalle_venta").insert([
          {
            venta_id: nuevaVentaId,
            cerdo_id: Number(cerdoId),
            cantidad: kilosVendidosLibriado,
            precio_unitario: totalLibriado / Math.max(1, kilosVendidosLibriado),
            subtotal: totalLibriado
          }
        ])
        if (detalleError) throw detalleError

        const { error: cerdoError } = await supabase
          .from("cerdos")
          .update({ estado: "vendido_kilo" })
          .eq("id", Number(cerdoId))
        if (cerdoError) throw cerdoError

        await supabase.from("movimientos_cerdos").insert([
          {
            cerdo_id: Number(cerdoId),
            tipo: "venta",
            descripcion: `Venta libriado - Venta #${nuevaVentaId}`,
            fecha
          }
        ])
      }

      navigate("/ventas")
    } catch (error) {
      toast.error(error.message || "No se pudo guardar la venta")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Nueva Venta</h1>

      <div className="bg-white shadow-lg rounded-xl p-4 mb-4">
        <h2 className="font-bold mb-3">1) Seleccionar cerdo</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select
            value={cerdoId}
            onChange={(e) => setCerdoId(e.target.value)}
            disabled={Boolean(ventaId)}
            className="border p-2 rounded"
          >
            <option value="">Seleccione cerdo vivo</option>
            {cerdos.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.id} — {c.peso}kg — {c.estado}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="border p-2 rounded"
          />
        </div>

        {cerdoSeleccionado && (
          <div className="mt-3 text-sm text-gray-700">
            ID: {cerdoSeleccionado.id} | Peso actual: {cerdoSeleccionado.peso} kg | Estado: {cerdoSeleccionado.estado}
          </div>
        )}
      </div>

      <div className="bg-white shadow-lg rounded-xl p-4 mb-4">
        <h2 className="font-bold mb-3">2) Tipo de venta</h2>
        <select
          value={tipoVenta}
          onChange={(e) => setTipoVenta(e.target.value)}
          className="border p-2 rounded w-full md:w-72"
        >
          {TIPOS_VENTA.map((tipo) => (
            <option key={tipo} value={tipo}>
              {tipo === "pie" ? "En pie" : tipo === "canal" ? "En canal" : "Libriado"}
            </option>
          ))}
        </select>
      </div>

      {(tipoVenta === "pie" || tipoVenta === "canal") && (
        <>
          <div className="bg-white shadow-lg rounded-xl p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder={tipoVenta === "pie" ? "Peso del cerdo" : "Peso canal"}
                value={pesoVenta}
                onChange={(e) => setPesoVenta(formatNumber(e.target.value))}
                className="border p-2 rounded"
              />
              <input
                type="text"
                placeholder="Precio por kilo"
                value={precioKilo}
                onChange={(e) => setPrecioKilo(formatNumber(e.target.value))}
                className="border p-2 rounded"
              />
              <div className="border p-2 rounded bg-gray-50">Total: ${totalDirecto.toLocaleString('es-CO')}</div>
            </div>
          </div>

          <div className="bg-white shadow-lg rounded-xl p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                className="border p-2 rounded"
              >
                <option value="">Seleccione cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>

              <select
                value={formaPago}
                onChange={(e) => setFormaPago(e.target.value)}
                className="border p-2 rounded"
              >
                <option value="contado">Contado</option>
                <option value="fiado">Fiado</option>
              </select>

              <input
                type="text"
                placeholder="Monto pagado"
                value={montoPagado}
                onChange={(e) => setMontoPagado(formatNumber(e.target.value))}
                className="border p-2 rounded"
              />

              <div className="border p-2 rounded bg-gray-50">Cambio: ${cambioDirecto.toLocaleString('es-CO')}</div>
            </div>
          </div>
        </>
      )}

      {tipoVenta === "libriado" && (
        <>
          <div className="bg-white shadow-lg rounded-xl p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Peso canal disponible"
                value={pesoCanalDisponible}
                onChange={(e) => setPesoCanalDisponible(formatNumber(e.target.value))}
                className="border p-2 rounded"
              />

              <select
                value={clienteLibriadoId}
                onChange={(e) => setClienteLibriadoId(e.target.value)}
                className="border p-2 rounded"
              >
                <option value="">Seleccione cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>

              <button
                onClick={agregarFilaLibriado}
                className="bg-blue-600 text-white px-4 py-2 rounded"
              >
                Agregar cliente a tabla
              </button>
            </div>
          </div>

          <div className="bg-white shadow-lg rounded-xl p-4 mb-4 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Kilos</th>
                  <th>Precio kilo</th>
                  <th>Subtotal</th>
                  <th>Observacion</th>
                  <th>Estado</th>
                  <th>Quitar</th>
                </tr>
              </thead>
              <tbody>
                {filasLibriado.map((fila) => (
                  <tr key={fila.id} className="border-t">
                    <td>{fila.cliente_nombre}</td>
                    <td>
                      <input
                        type="text"
                        value={fila.kilos}
                        onChange={(e) => actualizarFilaLibriado(fila.id, "kilos", formatNumber(e.target.value))}
                        className="border p-1 rounded w-24"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={fila.precio_kilo}
                        onChange={(e) => actualizarFilaLibriado(fila.id, "precio_kilo", formatNumber(e.target.value))}
                        className="border p-1 rounded w-28"
                      />
                    </td>
                    <td>${Number(fila.subtotal).toLocaleString('es-CO')}</td>
                    <td>
                      <input
                        value={fila.observacion}
                        onChange={(e) => actualizarFilaLibriado(fila.id, "observacion", e.target.value)}
                        className="border p-1 rounded"
                      />
                    </td>
                    <td>
                      <select
                        value={fila.estado}
                        onChange={(e) => actualizarFilaLibriado(fila.id, "estado", e.target.value)}
                        className="border p-1 rounded"
                      >
                        <option value="pagado">Pagado</option>
                        <option value="fiado">Fiado</option>
                      </select>
                    </td>
                    <td>
                      <button
                        onClick={() => quitarFilaLibriado(fila.id)}
                        className="text-red-600"
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3 text-sm">
              Kilos vendidos: {kilosVendidosLibriado} / {pesoCanalDisponible || 0}
            </div>
            <div className="font-bold mt-1">Total venta: ${totalLibriado}</div>
          </div>
        </>
      )}

      <div className="bg-white shadow-lg rounded-xl p-4 mb-4">
        <h2 className="font-bold mb-2">Ganancia estimada</h2>
        <p>Precio venta total: ${tipoVenta === "libriado" ? totalLibriado : totalDirecto}</p>
        <p>Precio compra cerdo: ${Number(cerdoSeleccionado?.costo_compra || 0)}</p>
        <p>Gastos asociados: ${gastosCerdo}</p>
        <p className="font-bold">Ganancia estimada: ${gananciaEstimada}</p>
      </div>

      <div className="bg-gray-50 border rounded-xl p-4 mb-4">
        <h2 className="font-bold mb-2">Resumen venta</h2>
        <p>Cerdo #{cerdoSeleccionado?.id || "-"}</p>
        <p>Tipo: {tipoVenta}</p>
        <p>Total: ${tipoVenta === "libriado" ? totalLibriado : totalDirecto}</p>
        <p>
          Cliente: {tipoVenta === "libriado"
            ? `${filasLibriado.length} cliente(s)`
            : clientes.find((c) => String(c.id) === String(clienteId))?.nombre || "-"}
        </p>
        <p>
          Pago: {tipoVenta === "libriado"
            ? "Mixto por cliente"
            : calcularEstadoVenta(totalDirecto, montoPagado, formaPago)}
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={guardarVenta}
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
        >
          {saving ? "Guardando..." : "Guardar venta"}
        </button>
        <button
          onClick={() => navigate("/ventas")}
          className="bg-gray-300 px-4 py-2 rounded"
        >
          Volver
        </button>
      </div>
    </div>
  )
}
