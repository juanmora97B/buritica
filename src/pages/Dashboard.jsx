import { lazy, Suspense, useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"

const DashboardSalesChart = lazy(() => import("../components/DashboardSalesChart"))

const formatearDinero = (valor) => Number(valor || 0).toLocaleString("es-CO")
const sumarPagos = (pagos) => (pagos || []).reduce((acc, p) => acc + Number(p.monto || 0), 0)

const inicioSemana = (fecha) => {
  const d = new Date(fecha)
  const dia = d.getDay() === 0 ? 6 : d.getDay() - 1
  d.setDate(d.getDate() - dia)
  d.setHours(0, 0, 0, 0)
  return d
}

export default function Dashboard() {
  const [cerdosVivos, setCerdosVivos] = useState(0)
  const [ventasHoy, setVentasHoy] = useState(0)
  const [ventasPeriodo, setVentasPeriodo] = useState(0)
  const [gastosPeriodo, setGastosPeriodo] = useState(0)
  const [ventasDiarias, setVentasDiarias] = useState([])
  const [ultimasVentas, setUltimasVentas] = useState([])
  const [clientesDeudores, setClientesDeudores] = useState([])
  const [alertaInventario, setAlertaInventario] = useState(false)

  const [filtroPeriodo, setFiltroPeriodo] = useState("mes")
  const [fechaInicio, setFechaInicio] = useState("")
  const [fechaFin, setFechaFin] = useState("")

  const [deudaTotal, setDeudaTotal] = useState(0)
  const [deudoresActivos, setDeudoresActivos] = useState(0)
  const [gananciaPorTipo, setGananciaPorTipo] = useState({ pie: 0, canal: 0, libriado: 0 })
  const [topCompradores, setTopCompradores] = useState([])
  const [topDeudores, setTopDeudores] = useState([])
  const [fiadosVencidosCantidad, setFiadosVencidosCantidad] = useState(0)
  const [fiadosVencidosMonto, setFiadosVencidosMonto] = useState(0)
  const [cierreDiario, setCierreDiario] = useState({
    fecha: "",
    ventasHoy: 0,
    gastosHoy: 0,
    pagosHoy: 0,
    deudaGeneradaHoy: 0,
    gananciaHoy: 0
  })

  const descargarCierreDiario = () => {
    const lineas = [
      ["fecha", "ventas_hoy", "gastos_hoy", "pagos_hoy", "deuda_generada_hoy", "ganancia_hoy"],
      [
        cierreDiario.fecha,
        cierreDiario.ventasHoy,
        cierreDiario.gastosHoy,
        cierreDiario.pagosHoy,
        cierreDiario.deudaGeneradaHoy,
        cierreDiario.gananciaHoy
      ]
    ]

    const csv = lineas.map((fila) => fila.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `cierre_diario_${cierreDiario.fecha || "hoy"}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const etiquetaPeriodo = useMemo(() => {
    if (filtroPeriodo === "hoy") return "hoy"
    if (filtroPeriodo === "semana") return "de la semana"
    if (filtroPeriodo === "custom") return "del rango"
    return "del mes"
  }, [filtroPeriodo])

  useEffect(() => {
    const fetchData = async () => {
      const hoy = new Date()
      const hoyStr = hoy.toISOString().split("T")[0]

      const [cerdosRes, ventasRes, gastosRes, pagosRes] = await Promise.all([
        supabase.from("cerdos").select("id, estado, costo_compra").order("id"),
        supabase
          .from("ventas")
          .select(`
            id, total, estado, fecha, cliente_id,
            clientes(nombre, dias_pago),
            detalle_venta(cerdo_id),
            ventas_libriado(id, cliente_id, subtotal, estado, clientes(nombre, dias_pago))
          `)
          .order("created_at", { ascending: false }),
        supabase.from("gastos").select("monto, fecha, cerdo_id"),
        supabase.from("pagos").select("venta_id, ventas_libriado_id, monto, fecha")
      ])

      const cerdos = cerdosRes.data || []
      const ventas = ventasRes.data || []
      const gastos = gastosRes.data || []
      const pagos = pagosRes.data || []

      const vivos = cerdos.filter((c) => c.estado === "vivo").length
      setCerdosVivos(vivos)
      setAlertaInventario(vivos <= 3)

      const fechaEnPeriodo = (fechaStr) => {
        if (!fechaStr) return false
        const f = new Date(`${fechaStr}T00:00:00`)

        if (filtroPeriodo === "hoy") {
          return fechaStr === hoyStr
        }

        if (filtroPeriodo === "semana") {
          const iniSemana = inicioSemana(hoy)
          const finSemana = new Date(iniSemana)
          finSemana.setDate(finSemana.getDate() + 6)
          return f >= iniSemana && f <= finSemana
        }

        if (filtroPeriodo === "custom") {
          if (!fechaInicio || !fechaFin) return true
          const ini = new Date(`${fechaInicio}T00:00:00`)
          const fin = new Date(`${fechaFin}T23:59:59`)
          return f >= ini && f <= fin
        }

        return f.getMonth() === hoy.getMonth() && f.getFullYear() === hoy.getFullYear()
      }

      const ventasHoyData = ventas.filter((v) => v.fecha === hoyStr)
      const ventasHoyTotal = ventasHoyData.reduce((acc, v) => acc + Number(v.total || 0), 0)
      const gastosHoyTotal = gastos.filter((g) => g.fecha === hoyStr).reduce((acc, g) => acc + Number(g.monto || 0), 0)
      const pagosHoyTotal = pagos.filter((p) => p.fecha === hoyStr).reduce((acc, p) => acc + Number(p.monto || 0), 0)
      setVentasHoy(ventasHoyTotal)

      const ventasFiltradas = ventas.filter((v) => fechaEnPeriodo(v.fecha))
      const gastosFiltrados = gastos.filter((g) => fechaEnPeriodo(g.fecha))

      setVentasPeriodo(ventasFiltradas.reduce((acc, v) => acc + Number(v.total || 0), 0))
      setGastosPeriodo(gastosFiltrados.reduce((acc, g) => acc + Number(g.monto || 0), 0))

      const agrupadas = {}
      ventasFiltradas.forEach((v) => {
        if (!agrupadas[v.fecha]) agrupadas[v.fecha] = 0
        agrupadas[v.fecha] += Number(v.total || 0)
      })
      setVentasDiarias(
        Object.keys(agrupadas)
          .sort()
          .map((fecha) => ({ fecha, total: agrupadas[fecha] }))
      )

      setUltimasVentas(ventas.slice(0, 5))

      const gastosPorCerdo = {}
      gastos.forEach((g) => {
        gastosPorCerdo[g.cerdo_id] = (gastosPorCerdo[g.cerdo_id] || 0) + Number(g.monto || 0)
      })

      const cerdosMap = {}
      cerdos.forEach((c) => {
        cerdosMap[c.id] = c
      })

      const gananciaTipo = { pie: 0, canal: 0, libriado: 0 }
      ventasFiltradas.forEach((venta) => {
        const cerdoId = venta.detalle_venta?.[0]?.cerdo_id
        const cerdo = cerdosMap[cerdoId]

        let tipo = "pie"
        if ((venta.ventas_libriado || []).length > 0 || cerdo?.estado === "vendido_kilo") tipo = "libriado"
        else if (cerdo?.estado === "vendido_canal") tipo = "canal"

        const ingreso = Number(venta.total || 0)
        const costoCompra = Number(cerdo?.costo_compra || 0)
        const gastoCerdo = Number(gastosPorCerdo[cerdoId] || 0)
        const ganancia = ingreso - costoCompra - gastoCerdo

        gananciaTipo[tipo] += ganancia
      })
      setGananciaPorTipo(gananciaTipo)

      const ventaIdsConLibriado = new Set()
      ventas.forEach((v) => {
        if ((v.ventas_libriado || []).length > 0) ventaIdsConLibriado.add(v.id)
      })

      const deudoresReales = []
      let fiadosVencidos = 0
      let montoVencido = 0
      let deudaGeneradaHoy = 0

      ventas.forEach((venta) => {
        if (venta.estado === "pagada") return
        if (ventaIdsConLibriado.has(venta.id)) return

        const pagosVenta = pagos.filter(
          (p) => p.venta_id === venta.id && !p.ventas_libriado_id
        )
        const deuda = Math.max(0, Number(venta.total || 0) - sumarPagos(pagosVenta))

        if (deuda > 0) {
          const diasPago = Number(venta.clientes?.dias_pago || 30)
          const fechaVencimiento = new Date(`${venta.fecha}T00:00:00`)
          fechaVencimiento.setDate(fechaVencimiento.getDate() + diasPago)
          const estaVencido = fechaVencimiento < new Date(`${hoyStr}T00:00:00`)

          deudoresReales.push({
            key: `venta-${venta.id}`,
            nombre: venta.clientes?.nombre || "Cliente sin nombre",
            referencia: `Venta #${venta.id}`,
            deuda
          })

          if (estaVencido) {
            fiadosVencidos += 1
            montoVencido += deuda
          }

          if (venta.fecha === hoyStr) {
            deudaGeneradaHoy += deuda
          }
        }
      })

      ventas.forEach((venta) => {
        ;(venta.ventas_libriado || []).forEach((fila) => {
          if (fila.estado !== "fiado") return
          const pagosFila = pagos.filter((p) => p.ventas_libriado_id === fila.id)
          const deuda = Math.max(0, Number(fila.subtotal || 0) - sumarPagos(pagosFila))

          if (deuda > 0) {
            const diasPago = Number(fila.clientes?.dias_pago || 30)
            const fechaVencimiento = new Date(`${venta.fecha}T00:00:00`)
            fechaVencimiento.setDate(fechaVencimiento.getDate() + diasPago)
            const estaVencido = fechaVencimiento < new Date(`${hoyStr}T00:00:00`)

            deudoresReales.push({
              key: `libriado-${fila.id}`,
              nombre: fila.clientes?.nombre || "Cliente sin nombre",
              referencia: `Libriado Venta #${venta.id}`,
              deuda
            })

            if (estaVencido) {
              fiadosVencidos += 1
              montoVencido += deuda
            }

            if (venta.fecha === hoyStr) {
              deudaGeneradaHoy += deuda
            }
          }
        })
      })

      setFiadosVencidosCantidad(fiadosVencidos)
      setFiadosVencidosMonto(montoVencido)

      setCierreDiario({
        fecha: hoyStr,
        ventasHoy: ventasHoyTotal,
        gastosHoy: gastosHoyTotal,
        pagosHoy: pagosHoyTotal,
        deudaGeneradaHoy,
        gananciaHoy: ventasHoyTotal - gastosHoyTotal
      })

      setClientesDeudores(deudoresReales)
      setDeudaTotal(deudoresReales.reduce((acc, d) => acc + d.deuda, 0))
      setDeudoresActivos(new Set(deudoresReales.map((d) => d.nombre)).size)

      const compradoresMap = {}
      ventasFiltradas.forEach((venta) => {
        const filasLibriado = venta.ventas_libriado || []
        if (filasLibriado.length > 0) {
          filasLibriado.forEach((fila) => {
            const nombre = fila.clientes?.nombre || "Cliente sin nombre"
            compradoresMap[nombre] = (compradoresMap[nombre] || 0) + Number(fila.subtotal || 0)
          })
        } else {
          const nombre = venta.clientes?.nombre || "Cliente sin nombre"
          compradoresMap[nombre] = (compradoresMap[nombre] || 0) + Number(venta.total || 0)
        }
      })

      const topCompras = Object.entries(compradoresMap)
        .map(([nombre, total]) => ({ nombre, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)
      setTopCompradores(topCompras)

      const deudoresMap = {}
      deudoresReales.forEach((d) => {
        deudoresMap[d.nombre] = (deudoresMap[d.nombre] || 0) + d.deuda
      })

      const topDeudas = Object.entries(deudoresMap)
        .map(([nombre, deuda]) => ({ nombre, deuda }))
        .sort((a, b) => b.deuda - a.deuda)
        .slice(0, 5)
      setTopDeudores(topDeudas)
    }

    fetchData()
  }, [filtroPeriodo, fechaInicio, fechaFin])

  const gananciaPeriodo = ventasPeriodo - gastosPeriodo

  return (
    <div className="p-6">
      {alertaInventario && (
        <div className="bg-yellow-100 text-yellow-800 p-4 rounded-xl mb-4">
          🚨 Inventario bajo: quedan pocos cerdos vivos
        </div>
      )}

      {fiadosVencidosCantidad > 0 && (
        <div className="bg-red-100 text-red-800 p-4 rounded-xl mb-4">
          ⚠️ Fiados vencidos: {fiadosVencidosCantidad} registros por $ {formatearDinero(fiadosVencidosMonto)}
        </div>
      )}

      <div className="bg-white shadow-lg rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Periodo</label>
          <select
            value={filtroPeriodo}
            onChange={(e) => setFiltroPeriodo(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="hoy">Hoy</option>
            <option value="semana">Semana</option>
            <option value="mes">Mes</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>

        {filtroPeriodo === "custom" && (
          <>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Desde</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="border p-2 rounded"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Hasta</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="border p-2 rounded"
              />
            </div>
          </>
        )}

        <button
          onClick={descargarCierreDiario}
          className="bg-green-700 text-white px-4 py-2 rounded"
        >
          Descargar cierre diario (CSV)
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card title="🐷 Cerdos vivos" value={cerdosVivos} />
        <Card title="💰 Ventas hoy" value={`$ ${formatearDinero(ventasHoy)}`} />
        <Card title={`📈 Ventas ${etiquetaPeriodo}`} value={`$ ${formatearDinero(ventasPeriodo)}`} />
        <Card title={`💸 Gastos ${etiquetaPeriodo}`} value={`$ ${formatearDinero(gastosPeriodo)}`} />
        <Card title={`🧮 Ganancia ${etiquetaPeriodo}`} value={`$ ${formatearDinero(gananciaPeriodo)}`} />
        <Card title="🧾 Deuda total por cobrar" value={`$ ${formatearDinero(deudaTotal)}`} />
        <Card title="👥 Deudores activos" value={deudoresActivos} />

        <div className="bg-white shadow-lg rounded-xl p-6 col-span-2">
          <h2 className="text-lg font-bold mb-4">📊 Ganancia neta por tipo de venta</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MiniCard title="Pie" value={`$ ${formatearDinero(gananciaPorTipo.pie)}`} />
            <MiniCard title="Canal" value={`$ ${formatearDinero(gananciaPorTipo.canal)}`} />
            <MiniCard title="Libriado" value={`$ ${formatearDinero(gananciaPorTipo.libriado)}`} />
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-xl p-6 col-span-2">
          <h2 className="text-lg font-bold mb-4">📊 Ventas por día</h2>
          <Suspense fallback={<div className="h-[300px] flex items-center justify-center text-gray-500">Cargando gráfica...</div>}>
            <DashboardSalesChart data={ventasDiarias} />
          </Suspense>
        </div>

        <div className="bg-white shadow-lg rounded-xl p-6 col-span-2">
          <h2 className="text-lg font-bold mb-4">📋 Últimas ventas</h2>
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>ID</th>
                <th>Fecha</th>
                <th>Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {ultimasVentas.map((v) => (
                <tr key={v.id} className="border-t">
                  <td>{v.id}</td>
                  <td>{v.fecha}</td>
                  <td>$ {formatearDinero(v.total)}</td>
                  <td>{v.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white shadow-lg rounded-xl p-6 col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-bold mb-3">🏆 Top 5 clientes por compra</h2>
            {topCompradores.length === 0 ? (
              <p className="text-sm text-gray-600">Sin compras en el periodo.</p>
            ) : (
              topCompradores.map((c, i) => (
                <div key={c.nombre} className="border-b py-2 text-sm flex justify-between">
                  <span>{i + 1}. {c.nombre}</span>
                  <span className="font-semibold">$ {formatearDinero(c.total)}</span>
                </div>
              ))
            )}
          </div>

          <div>
            <h2 className="text-lg font-bold mb-3">⚠️ Top 5 clientes con deuda</h2>
            {topDeudores.length === 0 ? (
              <p className="text-sm text-gray-600">No hay clientes con deuda.</p>
            ) : (
              topDeudores.map((c, i) => (
                <div key={c.nombre} className="border-b py-2 text-sm flex justify-between">
                  <span>{i + 1}. {c.nombre}</span>
                  <span className="font-semibold text-red-700">$ {formatearDinero(c.deuda)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-red-50 shadow-lg rounded-xl p-6 col-span-2">
          <h2 className="text-lg font-bold mb-4 text-red-600">⚠️ Clientes con deuda</h2>

          {clientesDeudores.length === 0 ? (
            <p className="text-sm text-gray-600">No hay clientes con deuda.</p>
          ) : (
            clientesDeudores.map((v) => (
              <div key={v.key} className="border-b py-2">
                {v.nombre} — {v.referencia} — $ {formatearDinero(v.deuda)}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function Card({ title, value }) {
  return (
    <div className="bg-white shadow-lg rounded-xl p-6">
      <h2 className="text-gray-500">{title}</h2>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  )
}

function MiniCard({ title, value }) {
  return (
    <div className="bg-gray-50 border rounded-lg p-4">
      <p className="text-sm text-gray-600">{title}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  )
}
