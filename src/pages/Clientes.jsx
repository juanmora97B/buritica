import { useEffect, useMemo, useState } from "react"
import toast from "react-hot-toast"
import { supabase } from "../lib/supabase"
import { canEditByRole } from "../lib/permissions"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { formatNumber, parseNumber } from "../utils/formatNumber"

const sumarPagos = (pagos) => pagos?.reduce((acc, p) => acc + Number(p.monto || 0), 0) ?? 0

export default function Clientes() {
  const { userProfile } = useCurrentUser()
  const canEdit = canEditByRole(userProfile?.rol)
  const [clientes, setClientes] = useState([])
  const [ventas, setVentas] = useState([])
  const [ventasLibriado, setVentasLibriado] = useState([])
  const [pagos, setPagos] = useState([])

  const [nombre, setNombre] = useState("")
  const [telefono, setTelefono] = useState("")
  const [direccion, setDireccion] = useState("")
  const [email, setEmail] = useState("")
  const [limiteCfredito, setLimiteCredito] = useState("")
  const [diasPago, setDiasPago] = useState("30")
  const [tipo, setTipo] = useState("minorista")
  const [estado, setEstado] = useState("activo")

  const [editId, setEditId] = useState(null)
  const [editNombre, setEditNombre] = useState("")
  const [editTelefono, setEditTelefono] = useState("")
  const [editDireccion, setEditDireccion] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editLimiteCredito, setEditLimiteCredito] = useState("")
  const [editDiasPago, setEditDiasPago] = useState("30")
  const [editTipo, setEditTipo] = useState("minorista")
  const [editEstado, setEditEstado] = useState("activo")

  const [historialId, setHistorialId] = useState(null)
  const [deudaDetalladoCliente, setDeudaDetalladoCliente] = useState([])
  
  const [contactosClienteId, setContactosClienteId] = useState(null)
  const [contactos, setContactos] = useState([])
  const [nuevoContactoTipo, setNuevoContactoTipo] = useState("telefono")
  const [nuevoContactoValor, setNuevoContactoValor] = useState("")
  const [nuevoContactoPrincipal, setNuevoContactoPrincipal] = useState(false)

  async function fetchClientes() {
    const { data } = await supabase.from("clientes").select("*").order("nombre")
    setClientes(data || [])
  }

  async function fetchVentas() {
    const { data } = await supabase
      .from("ventas")
      .select("id, total, cliente_id, fecha, estado")
      .order("created_at", { ascending: false })

    setVentas(data || [])
  }

  async function fetchVentasLibriado() {
    const { data } = await supabase
      .from("ventas_libriado")
      .select("id, venta_id, cliente_id, kilos, precio_kilo, subtotal, estado")

    setVentasLibriado(data || [])
  }

  async function fetchPagos() {
    const { data } = await supabase
      .from("pagos")
      .select("id, venta_id, ventas_libriado_id, monto, fecha, metodo")
      .order("fecha", { ascending: true })

    setPagos(data || [])
  }

  useEffect(() => {
    fetchClientes()
    fetchVentas()
    fetchVentasLibriado()
    fetchPagos()
  }, [])

  // Calcular deuda total por cliente
  const deudaTotalMap = useMemo(() => {
    const map = {}

    const ventaIdsLibriado = new Set((ventasLibriado || []).map((v) => v.venta_id))

    // Ventas normales
    ventas.forEach((v) => {
      if (ventaIdsLibriado.has(v.id)) return
      const pagadoVenta = sumarPagos(pagos.filter(p => p.venta_id === v.id && !p.ventas_libriado_id))
      const deuda = Math.max(0, Number(v.total || 0) - pagadoVenta)
      
      if (v.cliente_id && v.estado !== "pagada") {
        map[v.cliente_id] = (map[v.cliente_id] || 0) + deuda
      }
    })

    // Ventas libriado
    ventasLibriado.forEach((fila) => {
      if (fila.estado !== "fiado") return
      const pagadoLibriado = sumarPagos(pagos.filter(p => p.ventas_libriado_id === fila.id))
      const deuda = Math.max(0, Number(fila.subtotal || 0) - pagadoLibriado)
      
      map[fila.cliente_id] = (map[fila.cliente_id] || 0) + deuda
    })

    return map
  }, [ventas, ventasLibriado, pagos])

  // Obtener deudas detalladas de un cliente
  const obtenerDeudaDetallada = (clienteId) => {
    const deudas = []

    const ventaIdsLibriado = new Set((ventasLibriado || []).map((v) => v.venta_id))

    // Ventas normales del cliente
    ventas
      .filter(v => v.cliente_id === clienteId && !ventaIdsLibriado.has(v.id) && v.estado !== "pagada")
      .forEach(v => {
        const pagadoVenta = sumarPagos(pagos.filter(p => p.venta_id === v.id && !p.ventas_libriado_id))
        const deuda = Math.max(0, Number(v.total || 0) - pagadoVenta)
        
        if (deuda > 0) {
          deudas.push({
            tipo: "normal",
            ventaId: v.id,
            fecha: v.fecha,
            total: Number(v.total || 0),
            pagado: pagadoVenta,
            deuda: deuda,
            abonosPagos: pagos.filter(p => p.venta_id === v.id && !p.ventas_libriado_id)
          })
        }
      })

    // Ventas libriado del cliente
    ventasLibriado
      .filter(v => v.cliente_id === clienteId && v.estado === "fiado")
      .forEach(v => {
        const pagadoLibriado = sumarPagos(pagos.filter(p => p.ventas_libriado_id === v.id))
        const deuda = Math.max(0, Number(v.subtotal || 0) - pagadoLibriado)
        
        if (deuda > 0) {
          deudas.push({
            tipo: "libriado",
            libriado_id: v.id,
            ventaId: v.venta_id,
            fecha: ventas.find(vt => vt.id === v.venta_id)?.fecha,
            kilos: v.kilos,
            precioKilo: v.precio_kilo,
            total: Number(v.subtotal || 0),
            pagado: pagadoLibriado,
            deuda: deuda,
            abonosPagos: pagos.filter(p => p.ventas_libriado_id === v.id)
          })
        }
      })

    return deudas
  }

  const agregarCliente = async () => {
    if (!canEdit) return toast.error("No tienes permisos para editar información")
    if (!nombre) return toast.error("Ingrese nombre")

    const { error } = await supabase.from("clientes").insert([
      {
        nombre,
        telefono: telefono || null,
        direccion: direccion || null,
        email: email || null,
        limite_credito: limiteCfredito ? parseNumber(limiteCfredito) : 0,
        dias_pago: parseNumber(diasPago) || 30,
        tipo,
        estado
      }
    ])

    if (error) return toast.error(error.message)

    setNombre("")
    setTelefono("")
    setDireccion("")
    setEmail("")
    setLimiteCredito("")
    setDiasPago("30")
    setTipo("minorista")
    setEstado("activo")
    fetchClientes()
  }

  const iniciarEdicion = (cliente) => {
    if (!canEdit) return toast.error("No tienes permisos para editar información")
    setEditId(cliente.id)
    setEditNombre(cliente.nombre || "")
    setEditTelefono(cliente.telefono || "")
    setEditDireccion(cliente.direccion || "")
    setEditEmail(cliente.email || "")
    setEditLimiteCredito(formatNumber(cliente.limite_credito || ""))
    setEditDiasPago(formatNumber(cliente.dias_pago || "30"))
    setEditTipo(cliente.tipo || "minorista")
    setEditEstado(cliente.estado || "activo")
  }

  const cancelarEdicion = () => {
    setEditId(null)
    setEditNombre("")
    setEditTelefono("")
    setEditDireccion("")
    setEditEmail("")
    setEditLimiteCredito("")
    setEditDiasPago("30")
    setEditTipo("minorista")
    setEditEstado("activo")
  }

  const guardarEdicion = async (id) => {
    if (!canEdit) return toast.error("No tienes permisos para editar información")
    const { error } = await supabase
      .from("clientes")
      .update({
        nombre: editNombre,
        telefono: editTelefono || null,
        direccion: editDireccion || null,
        email: editEmail || null,
        limite_credito: editLimiteCredito ? parseNumber(editLimiteCredito) : 0,
        dias_pago: parseNumber(editDiasPago) || 30,
        tipo: editTipo,
        estado: editEstado
      })
      .eq("id", id)

    if (error) return toast.error(error.message)

    cancelarEdicion()
    fetchClientes()
  }

  const abrirHistorial = (clienteId) => {
    const deudas = obtenerDeudaDetallada(clienteId)
    setDeudaDetalladoCliente(deudas)
    setHistorialId(clienteId)
  }

  const abrirGestorContactos = async (clienteId) => {
    setContactosClienteId(clienteId)
    const { data } = await supabase
      .from("contacto_clientes")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("principal", { ascending: false })
    setContactos(data || [])
  }

  const agregarContacto = async () => {
    if (!canEdit) return toast.error("No tienes permisos para editar información")
    if (!nuevoContactoValor) return toast.error("Ingrese valor del contacto")

    const { error } = await supabase.from("contacto_clientes").insert([
      {
        cliente_id: contactosClienteId,
        tipo: nuevoContactoTipo,
        valor: nuevoContactoValor,
        principal: nuevoContactoPrincipal
      }
    ])

    if (error) return toast.error(error.message)

    setNuevoContactoValor("")
    setNuevoContactoTipo("telefono")
    setNuevoContactoPrincipal(false)
    abrirGestorContactos(contactosClienteId)
  }

  const eliminarContacto = async (id) => {
    if (!canEdit) return toast.error("No tienes permisos para editar información")
    if (!confirm("¿Eliminar este contacto?")) return

    const { error } = await supabase.from("contacto_clientes").delete().eq("id", id)
    if (error) return toast.error(error.message)

    abrirGestorContactos(contactosClienteId)
  }

  const marcarPrincipal = async (id) => {
    if (!canEdit) return toast.error("No tienes permisos para editar información")
    // Quitar principal de todos
    await supabase.from("contacto_clientes").update({ principal: false }).eq("cliente_id", contactosClienteId)

    // Marcar este como principal
    const { error } = await supabase.from("contacto_clientes").update({ principal: true }).eq("id", id)
    if (error) return toast.error(error.message)

    abrirGestorContactos(contactosClienteId)
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Clientes</h1>

      <div className="bg-white shadow rounded p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            placeholder="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="border p-2 rounded"
          />
          <input
            placeholder="Telefono"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className="border p-2 rounded"
          />
          <input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border p-2 rounded"
          />
          <input
            placeholder="Direccion"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            className="border p-2 rounded"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
          <input
            placeholder="Límite de crédito"
            type="text"
            value={limiteCfredito}
            onChange={(e) => setLimiteCredito(formatNumber(e.target.value))}
            className="border p-2 rounded"
          />
          <input
            placeholder="Días de pago"
            type="text"
            value={diasPago}
            onChange={(e) => setDiasPago(formatNumber(e.target.value))}
            className="border p-2 rounded"
          />
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="minorista">Minorista</option>
            <option value="mayorista">Mayorista</option>
            <option value="frigorífico">Frigorífico</option>
            <option value="otro">Otro</option>
          </select>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
            <option value="bloqueado">Bloqueado</option>
          </select>
        </div>
        <button
          onClick={agregarCliente}
          className="bg-blue-600 text-white px-4 py-2 rounded mt-3"
        >
          Agregar
        </button>
      </div>

      <div className="bg-white shadow rounded p-4">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Nombre</th>
              <th>Email</th>
              <th>Tipo</th>
              <th>Deuda actual</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id} className="border-t">
                {editId === c.id ? (
                  <>
                    <td className="py-2">
                      <input
                        value={editNombre}
                        onChange={(e) => setEditNombre(e.target.value)}
                        className="border p-1 rounded w-full"
                      />
                    </td>
                    <td>
                      <input
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="border p-1 rounded w-full text-xs"
                      />
                    </td>
                    <td>
                      <select
                        value={editTipo}
                        onChange={(e) => setEditTipo(e.target.value)}
                        className="border p-1 rounded w-full text-xs"
                      >
                        <option value="minorista">Minorista</option>
                        <option value="mayorista">Mayorista</option>
                        <option value="frigorífico">Frigorífico</option>
                        <option value="otro">Otro</option>
                      </select>
                    </td>
                    <td>${(deudaTotalMap[c.id] || 0).toLocaleString('es-CO')}</td>
                    <td>
                      <select
                        value={editEstado}
                        onChange={(e) => setEditEstado(e.target.value)}
                        className="border p-1 rounded w-full text-xs"
                      >
                        <option value="activo">Activo</option>
                        <option value="inactivo">Inactivo</option>
                        <option value="bloqueado">Bloqueado</option>
                      </select>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          onClick={() => guardarEdicion(c.id)}
                          className="bg-green-600 text-white px-2 py-1 rounded text-xs"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={cancelarEdicion}
                          className="bg-gray-300 px-2 py-1 rounded text-xs"
                        >
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2">{c.nombre}</td>
                    <td className="text-xs">{c.email || "-"}</td>
                    <td className="text-xs capitalize">{c.tipo || "-"}</td>
                    <td>${(deudaTotalMap[c.id] || 0).toLocaleString('es-CO')}</td>
                    <td className="text-xs">
                      <span className={`px-2 py-1 rounded ${c.estado === 'activo' ? 'bg-green-100 text-green-800' : c.estado === 'inactivo' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                        {c.estado || 'activo'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          onClick={() => iniciarEdicion(c)}
                          className="bg-blue-600 text-white px-2 py-1 rounded text-xs"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => abrirHistorial(c.id)}
                          className="bg-gray-600 text-white px-2 py-1 rounded text-xs"
                        >
                          Deudas
                        </button>
                        <button
                          onClick={() => abrirGestorContactos(c.id)}
                          className="bg-purple-600 text-white px-2 py-1 rounded text-xs"
                        >
                          Contactos
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {historialId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Deudas de {clientes.find(c => c.id === historialId)?.nombre}</h2>
                  <button
                    onClick={() => setHistorialId(null)}
                    className="text-white text-2xl hover:bg-blue-800 w-8 h-8 flex items-center justify-center rounded"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="p-6">
                {deudaDetalladoCliente.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Sin deudas registradas</p>
                ) : (
                  <div className="space-y-4">
                    {deudaDetalladoCliente.map((deuda, idx) => (
                      <div key={idx} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-600">
                              {deuda.tipo === "normal" ? `Venta Normal #${deuda.ventaId}` : `Venta Libriado #${deuda.ventaId}`}
                            </p>
                            <p className="text-xs text-gray-500">{deuda.fecha}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold">
                              {deuda.tipo === "libriado" ? `${deuda.kilos} kg × $${Number(deuda.precioKilo).toLocaleString('es-CO')}` : ""}
                            </p>
                            <p className="text-lg font-bold text-red-600">Deuda: ${deuda.deuda.toLocaleString('es-CO')}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-sm mb-3 border-t pt-3">
                          <div>
                            <span className="text-gray-600">Total:</span>
                            <p className="font-bold">${deuda.total.toLocaleString('es-CO')}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Pagado:</span>
                            <p className="font-bold text-green-600">${deuda.pagado.toLocaleString('es-CO')}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Deuda:</span>
                            <p className="font-bold text-red-600">${deuda.deuda.toLocaleString('es-CO')}</p>
                          </div>
                        </div>

                        {deuda.abonosPagos.length > 0 && (
                          <div className="border-t pt-3">
                            <p className="text-sm font-semibold text-gray-700 mb-2">Abonos:</p>
                            <div className="space-y-1">
                              {deuda.abonosPagos.map((abono, i) => (
                                <div key={i} className="flex justify-between text-sm bg-white p-2 rounded">
                                  <span>{new Date(abono.fecha).toLocaleDateString('es-CO')}</span>
                                  <span className="text-green-600 font-semibold">${Number(abono.monto).toLocaleString('es-CO')}</span>
                                  <span className="text-gray-500">{abono.metodo}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    <div className="mt-6 pt-4 border-t-2 border-blue-200 bg-blue-50 p-4 rounded">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Deuda total:</span>
                        <span className="text-red-600">
                          ${deudaDetalladoCliente.reduce((sum, d) => sum + d.deuda, 0).toLocaleString('es-CO')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {contactosClienteId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
                <h2 className="text-xl font-bold">Contactos de {clientes.find(c => c.id === contactosClienteId)?.nombre}</h2>
                <button onClick={() => setContactosClienteId(null)} className="text-2xl">×</button>
              </div>
              
              <div className="p-6">
                <div className="mb-6 p-4 bg-gray-50 rounded border">
                  <h3 className="font-semibold mb-3">Agregar nuevo contacto</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <select
                      value={nuevoContactoTipo}
                      onChange={(e) => setNuevoContactoTipo(e.target.value)}
                      className="border p-2 rounded"
                    >
                      <option value="telefono">Teléfono</option>
                      <option value="email">Email</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="otro">Otro</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Valor"
                      value={nuevoContactoValor}
                      onChange={(e) => setNuevoContactoValor(e.target.value)}
                      className="border p-2 rounded"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="principal"
                        checked={nuevoContactoPrincipal}
                        onChange={(e) => setNuevoContactoPrincipal(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <label htmlFor="principal" className="text-sm">Principal</label>
                      <button
                        onClick={agregarContacto}
                        className="ml-auto bg-blue-600 text-white px-3 py-1 rounded text-sm"
                      >
                        Agregar
                      </button>
                    </div>
                  </div>
                </div>

                {contactos.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Sin contactos</p>
                ) : (
                  <div className="space-y-2">
                    {contactos.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-3 border rounded hover:bg-gray-50">
                        <div className="flex-1">
                          <p className="font-semibold capitalize">{c.tipo}</p>
                          <p className="text-sm text-gray-600">{c.valor}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {c.principal && <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Principal</span>}
                          {!c.principal && (
                            <button
                              onClick={() => marcarPrincipal(c.id)}
                              className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300"
                            >
                              Principal
                            </button>
                          )}
                          <button
                            onClick={() => eliminarContacto(c.id)}
                            className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
