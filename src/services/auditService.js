import { supabase } from "../lib/supabase"

export const registrarAuditoria = async ({
  usuarioId = null,
  modulo,
  accion,
  entidad,
  entidadId = null,
  descripcion = null,
  metadata = null
}) => {
  if (!supabase) return

  const payload = {
    usuario_id: usuarioId,
    modulo,
    accion,
    entidad,
    entidad_id: entidadId,
    descripcion,
    metadata
  }

  const { error } = await supabase.from("auditoria").insert([payload])

  if (error) {
    console.error("Error registrando auditoría:", error)
  }
}

export const listAuditoria = async ({
  modulo = "todos",
  usuarioId = "todos",
  fechaInicio = "",
  fechaFin = ""
} = {}) => {
  if (!supabase) return []

  let query = supabase
    .from("auditoria")
    .select("id, usuario_id, modulo, accion, entidad, entidad_id, descripcion, metadata, created_at, usuarios(nombre, email)")
    .order("created_at", { ascending: false })
    .limit(300)

  if (modulo !== "todos") {
    query = query.eq("modulo", modulo)
  }

  if (usuarioId !== "todos") {
    query = query.eq("usuario_id", usuarioId)
  }

  if (fechaInicio) {
    query = query.gte("created_at", `${fechaInicio}T00:00:00`)
  }

  if (fechaFin) {
    query = query.lte("created_at", `${fechaFin}T23:59:59`)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error listando auditoría:", error)
    return []
  }

  return data || []
}
